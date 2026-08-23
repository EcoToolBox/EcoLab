import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import geopandas as gpd
from functools import lru_cache
import pandas as pd
from scipy.ndimage import gaussian_filter
from scipy.interpolate import griddata
from shapely import contains, points

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

def generate_model_maps(
    results: dict,
    prediction_grid_df: pd.DataFrame,
    presence_points_df: pd.DataFrame,
    country: str,
    output_dir: str = "maps",
    species_name: str = None,
    heatmap_resolution: int = 400,
    smoothing_sigma: float = 2.0,
) -> dict:
    """
    Gera um mapa por modelo, prevendo a probabilidade DIRETAMENTE em cada
    célula do grid ambiental (prediction_grid_df) — não interpola entre os
    pontos de treino. `presence_points_df` é usado só para plotar os
    marcadores de presença por cima do mapa.

    Como o grid de predição costuma ser esparso (pontos espalhados, não uma
    malha densa cobrindo o país inteiro), os valores previstos são
    interpolados numa malha fina e contínua (griddata) antes de virar o
    heatmap — só jogar os valores numa matriz e suavizar com gaussian_filter
    deixa buracos onde não existem pontos amostrados por perto.
    """
    os.makedirs(output_dir, exist_ok=True)

    world = _load_world_shapefile()
    country_shape = world[world["NAME"].str.lower() == country.lower()]

    if country_shape.empty:
        raise ValueError(f"País '{country}' não encontrado no shapefile.")

    lon_min, lat_min, lon_max, lat_max = country_shape.total_bounds
    country_geometry = country_shape.union_all()
    presence_flag = pd.to_numeric(presence_points_df.get("presence", pd.Series(dtype=float)), errors="coerce")
    presences = presence_points_df[presence_flag == 1]
    print(f"Presenças encontradas para plot: {len(presences)}")

    image_paths = {}

    for model_name, model_result in results.items():
        try:
            model    = model_result["model"]
            features = model_result["feature_cols"]
            label    = MODEL_LABELS.get(model_name, model_name.upper())

            missing_features = [f for f in features if f not in prediction_grid_df.columns]
            if missing_features:
                raise ValueError(f"Grid de predição não tem as variáveis: {missing_features}")

            X_grid = prediction_grid_df[features].copy()
            mask   = X_grid.notna().all(axis=1)

            if mask.sum() == 0:
                raise ValueError("Nenhuma célula do grid ambiental tem todas as variáveis preenchidas.")

            # Predição direta em cada célula do grid ambiental (não interpolada nos features).
            raw_probs = model.predict_proba(X_grid[mask])
            probs = raw_probs[:, 1] if raw_probs.ndim == 2 else np.asarray(raw_probs).reshape(-1)

            lons = prediction_grid_df.loc[mask, "longitude"].to_numpy(dtype=float)
            lats = prediction_grid_df.loc[mask, "latitude"].to_numpy(dtype=float)

            fig, ax = plt.subplots(figsize=(10, 12))

            country_shape.plot(ax=ax, color="#d9d9d9", edgecolor="black", linewidth=0.8, zorder=1)

            # ---------------------------------------------------------------
            # Malha fina para o heatmap (proporcional ao bbox do país)
            # ---------------------------------------------------------------

            lon_range = lon_max - lon_min
            lat_range = lat_max - lat_min

            if lon_range >= lat_range:
                n_lon = heatmap_resolution
                n_lat = max(2, int(heatmap_resolution * lat_range / lon_range))
            else:
                n_lat = heatmap_resolution
                n_lon = max(2, int(heatmap_resolution * lon_range / lat_range))

            plot_lons = np.linspace(lon_min, lon_max, n_lon)
            plot_lats = np.linspace(lat_min, lat_max, n_lat)
            lon_mesh, lat_mesh = np.meshgrid(plot_lons, plot_lats)

            # ---------------------------------------------------------------
            # Interpola os pontos esparsos do grid ambiental na malha fina
            # ---------------------------------------------------------------

            sample_points = np.column_stack([lons, lats])

            plot_grid = griddata(
                points=sample_points,
                values=probs,
                xi=(lon_mesh, lat_mesh),
                method="linear",
            )

            # Fora do casco convexo dos pontos amostrados o griddata("linear")
            # deixa NaN — preenche com o vizinho mais próximo pra não sobrar buraco.
            nan_mask = np.isnan(plot_grid)
            if nan_mask.any():
                nearest_fill = griddata(
                    points=sample_points,
                    values=probs,
                    xi=(lon_mesh, lat_mesh),
                    method="nearest",
                )
                plot_grid[nan_mask] = nearest_fill[nan_mask]

            # Suavização leve só pra tirar a aparência "poligonal" da interpolação linear
            plot_grid = gaussian_filter(plot_grid, sigma=smoothing_sigma)
            plot_grid = np.clip(plot_grid, 0.0, 1.0)

            # ---------------------------------------------------------------
            # Máscara do país
            # ---------------------------------------------------------------

            grid_geometry = points(lon_mesh.ravel(), lat_mesh.ravel())
            inside_country = contains(country_geometry, grid_geometry).reshape(lat_mesh.shape)
            plot_grid[~inside_country] = np.nan

            # ---------------------------------------------------------------
            # Heatmap
            # ---------------------------------------------------------------

            im = ax.imshow(
                plot_grid,
                extent=[lon_min, lon_max, lat_min, lat_max],
                origin="lower",
                cmap="Greens",
                vmin=0,
                vmax=1,
                interpolation="bicubic",
                zorder=2,
                alpha=0.90,
                aspect="auto",
            )

            country_shape.plot(ax=ax, color="none", edgecolor="black", linewidth=1.0, zorder=3)

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
                "metrics_std": model_result.get("metrics_std"),
                "fold_metrics": model_result.get("fold_metrics"),
                "validation_mode": model_result.get("validation_mode"),
                "n_folds": model_result.get("n_folds"),
                "variable_importance": model_result.get("feature_importance", {}),
            }

        except Exception as e:
            print(f"Erro ao gerar mapa para {model_name}: {e}")
            image_paths[model_name] = {
                "path": None,
                "metrics": model_result.get("metrics", {}),
                "metrics_std": model_result.get("metrics_std"),
                "fold_metrics": model_result.get("fold_metrics"),
                "validation_mode": model_result.get("validation_mode"),
                "n_folds": model_result.get("n_folds"),
                "variable_importance": model_result.get("feature_importance", {}),
            }

    return image_paths