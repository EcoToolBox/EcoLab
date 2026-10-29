import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import BoundaryNorm, ListedColormap

# Escala "de calor" em faixas (tiers) de 0,1: do amarelo-claro (pouco adequado)
# ao vinho (muito adequado). Faixas discretas deixam as áreas mais fáceis de
# comparar entre modelos do que um gradiente contínuo.
HEAT_COLORS = [
    "#ffffcc", "#ffeda0", "#fed976", "#feb24c", "#fd8d3c",
    "#fc4e2a", "#e31a1c", "#bd0026", "#9e0026", "#800026",
]
HEAT_LEVELS = np.linspace(0.0, 1.0, len(HEAT_COLORS) + 1)
HEAT_CMAP = ListedColormap(HEAT_COLORS, name="ecolab_heat")
HEAT_NORM = BoundaryNorm(HEAT_LEVELS, HEAT_CMAP.N)
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
    "ensemble": "Ensemble (média ponderada)",
}

class _Canvas:
    """
    Geometria do heatmap de um grid de predição: malha fina, máscara do país
    e a forma de levar os valores do grid para a malha. Construída uma vez
    por grid (cache) porque era o que mais pesava: antes cada mapa refazia a
    triangulação de todas as células e o teste célula a célula do país.

    - Grid regular (o caso normal: rasters, GEE, planilhas em grade): os
      valores vão direto para uma matriz e são reamostrados bilinearmente
      para a malha (map_coordinates), sem triangulação.
    - Grid irregular (pontos espalhados): a triangulação de Delaunay e o
      vizinho mais próximo de cada nó da malha são calculados uma vez só.
    """

    def __init__(self, lons, lats, country_geometry, bounds, heatmap_resolution):
        from scipy.spatial import Delaunay, cKDTree
        from shapely import contains_xy

        lon_min, lat_min, lon_max, lat_max = bounds
        lon_range, lat_range = lon_max - lon_min, lat_max - lat_min
        if lon_range >= lat_range:
            n_lon = heatmap_resolution
            n_lat = max(2, int(heatmap_resolution * lat_range / lon_range))
        else:
            n_lat = heatmap_resolution
            n_lon = max(2, int(heatmap_resolution * lon_range / lat_range))
        self.lon_mesh, self.lat_mesh = np.meshgrid(
            np.linspace(lon_min, lon_max, n_lon), np.linspace(lat_min, lat_max, n_lat)
        )
        self.inside = contains_xy(country_geometry, self.lon_mesh, self.lat_mesh)

        self.lons, self.lats = lons, lats
        self.regular = self._setup_regular(lons, lats)
        if not self.regular:
            pts = np.column_stack([lons, lats])
            self.tri = Delaunay(pts)
            self.nearest_idx = cKDTree(pts).query(
                np.column_stack([self.lon_mesh.ravel(), self.lat_mesh.ravel()])
            )[1]

    def _setup_regular(self, lons, lats, tol=0.02, max_cells=25_000_000):
        def axis(v):
            u = np.unique(np.round(v, 8))
            if len(u) < 2:
                return None
            step = float(np.median(np.diff(u)))
            if step <= 0:
                return None
            idx = (v - u[0]) / step
            if np.abs(idx - np.round(idx)).max() > tol:
                return None
            return u[0], step, np.round(idx).astype(np.int64)

        ax_x, ax_y = axis(lons), axis(lats)
        if ax_x is None or ax_y is None:
            return False
        (self.x0, self.dx, self.ix), (self.y0, self.dy, self.iy) = ax_x, ax_y
        self.nx, self.ny = int(self.ix.max()) + 1, int(self.iy.max()) + 1
        if self.nx * self.ny > max_cells:
            return False
        self.mesh_coords = np.array([
            (self.lat_mesh - self.y0) / self.dy,
            (self.lon_mesh - self.x0) / self.dx,
        ])
        return True

    def render(self, probs, valid, smoothing_sigma):
        from scipy.interpolate import LinearNDInterpolator
        from scipy.ndimage import distance_transform_edt, map_coordinates

        probs = np.asarray(probs, dtype=float)
        if self.regular:
            arr = np.full((self.ny, self.nx), np.nan)
            arr[self.iy[valid], self.ix[valid]] = probs
            holes = np.isnan(arr)
            if holes.any():
                # Células sem valor herdam o vizinho mais próximo (como antes,
                # para não sobrar buraco na borda).
                idx = distance_transform_edt(holes, return_distances=False, return_indices=True)
                arr = arr[tuple(idx)]
            plot_grid = map_coordinates(arr, self.mesh_coords, order=1, mode="nearest")
        elif valid.all():
            plot_grid = LinearNDInterpolator(self.tri, probs)(self.lon_mesh, self.lat_mesh)
            holes = np.isnan(plot_grid)
            if holes.any():
                plot_grid[holes] = probs[self.nearest_idx.reshape(plot_grid.shape)[holes]]
        else:  # caso raro: o modelo não pôde prever em parte das células
            pts = np.column_stack([self.lons[valid], self.lats[valid]])
            plot_grid = griddata(pts, probs, (self.lon_mesh, self.lat_mesh), method="linear")
            holes = np.isnan(plot_grid)
            if holes.any():
                near = griddata(pts, probs, (self.lon_mesh, self.lat_mesh), method="nearest")
                plot_grid[holes] = near[holes]

        plot_grid = gaussian_filter(plot_grid, sigma=smoothing_sigma)
        plot_grid = np.clip(plot_grid, 0.0, 1.0)
        plot_grid[~self.inside] = np.nan
        return plot_grid


_CANVAS_CACHE: dict = {}


def _get_canvas(grid_df, country, country_geometry, bounds, heatmap_resolution) -> _Canvas:
    import hashlib

    lons = grid_df["longitude"].to_numpy(dtype=float)
    lats = grid_df["latitude"].to_numpy(dtype=float)
    key = (
        str(country).lower(), heatmap_resolution,
        hashlib.md5(lons.tobytes()).hexdigest(), hashlib.md5(lats.tobytes()).hexdigest(),
    )
    if key not in _CANVAS_CACHE:
        if len(_CANVAS_CACHE) >= 4:
            _CANVAS_CACHE.pop(next(iter(_CANVAS_CACHE)))
        _CANVAS_CACHE[key] = _Canvas(lons, lats, country_geometry, bounds, heatmap_resolution)
    return _CANVAS_CACHE[key]


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

    canvas = _get_canvas(prediction_grid_df, country, country_geometry,
                         (lon_min, lat_min, lon_max, lat_max), heatmap_resolution)

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

            fig, ax = plt.subplots(figsize=(10, 12))

            country_shape.plot(ax=ax, color="#d9d9d9", edgecolor="black", linewidth=0.8, zorder=1)

            # Malha fina do heatmap: a geometria (malha, máscara do país,
            # triangulação/índices) é calculada uma vez por grid e reaproveitada
            # por todos os modelos e espécies; aqui só entram os valores.
            plot_grid = canvas.render(probs, mask.to_numpy(), smoothing_sigma)

            # ---------------------------------------------------------------
            # Heatmap
            # ---------------------------------------------------------------

            im = ax.imshow(
                plot_grid,
                extent=[lon_min, lon_max, lat_min, lat_max],
                origin="lower",
                cmap=HEAT_CMAP,
                norm=HEAT_NORM,
                interpolation="nearest",
                zorder=2,
                aspect="auto",
            )

            country_shape.plot(ax=ax, color="none", edgecolor="#333333", linewidth=0.8, zorder=3)

            # Ocorrências discretas (cinza) para não competir com o mapa
            ax.scatter(
                presences["longitude"].astype(float), presences["latitude"].astype(float),
                c="#6e6e6e", s=5, alpha=0.45, linewidths=0, label="Presenças", zorder=4
            )

            cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.04, ticks=HEAT_LEVELS)
            cbar.ax.set_yticklabels([f"{v:.1f}" for v in HEAT_LEVELS])
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
                "ensemble_info": model_result.get("ensemble_info"),
                "target": model_result.get("target", "binary"),
                "kde_r2": model_result.get("kde_r2"),
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
                "ensemble_info": model_result.get("ensemble_info"),
                "target": model_result.get("target", "binary"),
                "kde_r2": model_result.get("kde_r2"),
            }

    return image_paths