import os
import numpy as np
import matplotlib.pyplot as plt
import geopandas as gpd
from scipy.interpolate import griddata
from shapely.vectorized import contains
from functools import lru_cache
import pandas as pd

@lru_cache(maxsize=None)
def _load_world_shapefile():
    URL = "https://naturalearth.s3.amazonaws.com/110m_cultural/ne_110m_admin_0_countries.zip"
    return gpd.read_file(URL)

MODEL_LABELS = {
    "maxent": "MaxEnt",
    "gam": "GAM",
    "random_forest": "Random Forest",
    "svm": "SVM",
    "brt": "BRT",
}

def generate_model_maps(results: dict, total: pd.DataFrame, country: str, output_dir: str = "maps", species_name: str = None) -> dict:
    os.makedirs(output_dir, exist_ok=True)

    world = _load_world_shapefile()
    country_shape = world[world["NAME"].str.lower() == country.lower()]

    if country_shape.empty:
        raise ValueError(f"País '{country}' não encontrado no shapefile.")

    lon_min, lat_min, lon_max, lat_max = country_shape.total_bounds
    country_geom = country_shape.union_all()

    lon_grid = np.linspace(lon_min, lon_max, 400)
    lat_grid = np.linspace(lat_min, lat_max, 400)
    lon_mesh, lat_mesh = np.meshgrid(lon_grid, lat_grid)

    inside_mask = contains(country_geom, lon_mesh.ravel(), lat_mesh.ravel()).reshape(lon_mesh.shape)

    image_paths = {}

    for model_name, model_result in results.items():
        try:
            model    = model_result["model"]
            features = model_result["feature_cols"]
            label    = MODEL_LABELS.get(model_name, model_name.upper())

            X_all = total[features].copy()
            mask  = X_all.notna().all(axis=1)

            probs   = np.full(len(X_all), np.nan)
            X_valid = X_all[mask]
            scaler  = model_result.get("scaler")

            if scaler is not None:
                X_input = scaler.transform(X_valid)
            else:
                X_input = X_valid.values

            raw_probs = model.predict_proba(X_input)
            if raw_probs.ndim == 2:
                probs[mask] = raw_probs[:, 1]
            else:
                probs[mask] = raw_probs

            lons = total["longitude"].values
            lats = total["latitude"].values

            prob_grid = griddata(
                points=np.column_stack([lons[mask], lats[mask]]),
                values=probs[mask],
                xi=(lon_mesh, lat_mesh),
                method="linear",
            )
            prob_grid[~inside_mask] = np.nan

            fig, ax = plt.subplots(figsize=(10, 12))

            country_shape.plot(ax=ax, color="#d9d9d9", edgecolor="black", linewidth=0.8, zorder=1)

            im = ax.contourf(
                lon_mesh, lat_mesh, prob_grid,
                levels=50,
                cmap="Greens",
                vmin=0, vmax=1,
                zorder=2,
                alpha=0.90,
            )

            country_shape.plot(ax=ax, color="none", edgecolor="black", linewidth=1.0, zorder=3)

            presences = total[total["presence"] == 1]
            ax.scatter(
                presences["longitude"].astype(float), presences["latitude"].astype(float),
                c="black", s=12, alpha=0.7, label="Presenças", zorder=4
            )

            cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.04)
            cbar.set_label("Probabilidade de ocorrência", fontsize=11)

            title_species = species_name if species_name else "Espécie"
            ax.set_title(f"Distribuição Potencial de {title_species} — {label}", fontsize=13)
            ax.set_xlabel("Longitude")
            ax.set_ylabel("Latitude")
            ax.legend(fontsize=9)
            ax.set_xlim(lon_min - 0.5, lon_max + 0.5)
            ax.set_ylim(lat_min - 0.5, lat_max + 0.5)

            plt.tight_layout()

            fname = f"mapa_{model_name}_{species_name}.png" if species_name else f"mapa_{model_name}_species.png"
            path  = os.path.join(output_dir, fname)
            plt.savefig(path, dpi=150, bbox_inches="tight")
            plt.close(fig)

            image_paths[model_name] = {
                "path": path,
                "metrics": model_result.get("metrics", {}),
                "variable_importance": model_result.get("feature_importance", {}),
            }

        except Exception as e:
            print(f"Erro ao gerar mapa para {model_name}: {e}")
            image_paths[model_name] = {
                "path": None,
                "metrics": model_result.get("metrics", {}),
                "variable_importance": model_result.get("feature_importance", {}),
            }

    return image_paths