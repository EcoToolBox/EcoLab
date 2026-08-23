import hashlib
import json

from shapely.strtree import STRtree
from scipy.spatial import cKDTree
from functools import lru_cache
import pandas as pd
import numpy as np
import geopandas as gpd
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import pycountry

sys.path.append(str(Path(__file__).resolve().parent.parent.parent))
from services import get_environment, get_interactions
_GRID_CACHE: dict[str, pd.DataFrame] = {}

WORLD_BBOX = (-90, -180, 90, 180)
RESOLUTION_DEG = 1 / 111

@lru_cache(maxsize=None)
def _load_world_shapefile():
    URL = "https://naturalearth.s3.amazonaws.com/110m_cultural/ne_110m_admin_0_countries.zip"
    return gpd.read_file(URL)

def get_country_grid(country_name: str, resolution_deg: float = RESOLUTION_DEG) -> gpd.GeoDataFrame:
    country_code = pycountry.countries.search_fuzzy(country_name)[0].alpha_3
    world = _load_world_shapefile() 

    country_code = pycountry.countries.search_fuzzy(country_name)
    country_code = country_code[0].alpha_3

    country = world[world["ISO_A3"] == country_code]
    if country.empty:
        raise ValueError(f"País '{country_name}' não encontrado.")
    
    shape = country.union_all()
    
    lon_min, lat_min, lon_max, lat_max = shape.bounds
    
    lats = np.arange(lat_min, lat_max, resolution_deg)
    lons = np.arange(lon_min, lon_max, resolution_deg)
    lons_grid, lats_grid = np.meshgrid(lons, lats)
    points = gpd.points_from_xy(lons_grid.ravel(), lats_grid.ravel())

    tree = STRtree(points)
    mask = tree.query(shape, predicate="contains")

    grid_gdf = gpd.GeoDataFrame(geometry=points[mask], crs="EPSG:4326")
    
    grid_gdf["latitude"] = grid_gdf.geometry.y
    grid_gdf["longitude"] = grid_gdf.geometry.x
    print(f"Grid gerado com {len(grid_gdf)} pontos.")
    return grid_gdf

def generate_grid_points(
    points: list[tuple[float, float]] = None,
    resolution_deg: float = RESOLUTION_DEG,
) -> pd.DataFrame:
    if points and len(points) >= 2:
        lats = [p[0] for p in points]
        lons = [p[1] for p in points]
        lat_min, lat_max = min(lats), max(lats)
        lon_min, lon_max = min(lons), max(lons)
        source = "pontos informados"
    else:
        lat_min, lon_min, lat_max, lon_max = WORLD_BBOX
        source = "mundo inteiro"

    print(f"Gerando grid para: {source}")
    lats = np.arange(lat_min, lat_max, resolution_deg)
    lons = np.arange(lon_min, lon_max, resolution_deg)
    grid_points = [
        {"latitude": float(round(lat, 5)), "longitude": float(round(lon, 5))}
        for lat in lats for lon in lons
    ]
    print(f"Grid gerado com {len(grid_points)} pontos.")
    return pd.DataFrame(grid_points)

def _safe_date_for_grid(grid_df: pd.DataFrame, occurrences) -> pd.DataFrame:
    grid_df = grid_df.copy()

    ref_date = None

    if occurrences is None:
        occ_df = pd.DataFrame()

    elif isinstance(occurrences, pd.DataFrame):
        occ_df = occurrences

    elif isinstance(occurrences, list):
        occ_df = pd.DataFrame(occurrences)

    else:
        occ_df = pd.DataFrame()

    if not occ_df.empty:
        for col in ["eventDate", "date", "year"]:
            if col in occ_df.columns:
                try:
                    dates = pd.to_datetime(occ_df[col], errors="coerce").dropna()
                    if not dates.empty:
                        today = pd.Timestamp(date.today()) - pd.Timedelta(days=15)
                        ref_date = dates.iloc[(dates - today).abs().argmin()].strftime("%Y-%m-%d")
                        print(f"eventDate do grid definido pela data mais próxima de hoje: {ref_date}")
                        break
                except Exception:
                    pass

    if ref_date is None:
        ref_date = date.today().isoformat()
        print(f"eventDate do grid definido como hoje: {ref_date}")

    grid_df["eventDate"] = ref_date
    return grid_df


def _to_dataframe(result, fallback: pd.DataFrame) -> pd.DataFrame:
    """Converte resultado de serviço para DataFrame de forma segura."""
    if isinstance(result, (gpd.GeoDataFrame, pd.DataFrame)):
        return result.drop(columns=["geometry"], errors="ignore").reset_index(drop=True)
    elif isinstance(result, list):
        return pd.DataFrame(result).reset_index(drop=True)
    return fallback

def fetch_env_indices(
    grid_df: pd.DataFrame,
    geeProject: str,
    occurrences: list[dict] = None,
) -> pd.DataFrame:
    print("occurrences")
    
    print(occurrences)

    all_occ_df = pd.DataFrame(occurrences if occurrences is not None else [])
    available_cols = all_occ_df.columns.tolist()

    index = [
        name for flag, name in [
            ("NDVI" in available_cols, "ndvi"),
            ("NDWI" in available_cols, "ndwi"),
            ("tavg" in available_cols, "temperature"),
            ("prec" in available_cols, "precipitation"),
        ] if flag
    ]

    if not index:
        print("Nenhum índice ambiental solicitado.")
        return grid_df

    grid_df = _safe_date_for_grid(grid_df, occurrences)

    try:
        env_result = get_environment.get_environment({
            "data": grid_df.to_dict(orient="records"),
            "index": index,
            "geeProject": geeProject
        })
        if isinstance(env_result, dict):
            env_result = env_result.get("msg", env_result)
        return _to_dataframe(env_result, grid_df)
    except Exception as e:
        print(f"Erro ao buscar índices ambientais: {e}")
        for col in ["NDVI", "NDWI", "tavg", "prec"]:
            grid_df[col] = np.nan
        return grid_df

def fetch_interaction_presence(
    grid_df: pd.DataFrame,
    interactions: list[dict],
    selected_species: list[str],
) -> pd.DataFrame:
    if not interactions:
        print("Nenhuma interação informada.")
        return grid_df

    records = grid_df.to_dict(orient="records")
    current_year = date.today().year
    for r in records:
        r.setdefault("year", current_year)

    try:
        result = get_interactions.add_interaction_occurrence({
            "occurrence": records,
            "interactions": interactions,
            "selectedSpecies": selected_species,
        }, False)
        return _to_dataframe(result, grid_df)
    except Exception as e:
        print(f"Erro ao buscar interações: {e}")
        return grid_df

def attach_nearest_grid_features(
    points_df: pd.DataFrame,
    grid_df: pd.DataFrame,
    feature_cols: list[str],
) -> pd.DataFrame:
    """
    Anexa a `points_df` (ex: ocorrências) os valores das colunas em `feature_cols`
    tirados do ponto de `grid_df` mais próximo (vizinho mais próximo por lat/long).

    Usado quando o grid ambiental vem de uma planilha enviada pelo usuário: as
    ocorrências não têm variáveis próprias, então herdam do ponto do grid mais
    perto delas.
    """
    if points_df.empty or grid_df.empty or not feature_cols:
        return points_df

    points_df = points_df.copy()
    valid_grid = grid_df.dropna(subset=["latitude", "longitude"]).reset_index(drop=True)
    if valid_grid.empty:
        return points_df

    tree = cKDTree(valid_grid[["latitude", "longitude"]].to_numpy())
    query_coords = points_df[["latitude", "longitude"]].apply(pd.to_numeric, errors="coerce")
    valid_mask = query_coords.notna().all(axis=1)

    _, nearest_idx = tree.query(query_coords[valid_mask].to_numpy(), k=1)

    for col in feature_cols:
        if col not in valid_grid.columns:
            continue
        if col not in points_df.columns:
            points_df[col] = np.nan
        points_df.loc[valid_mask, col] = valid_grid[col].to_numpy()[nearest_idx]

    return points_df


def _hash_args(*args) -> str:
    def safe_serialize(obj):
        if isinstance(obj, dict):
            return {str(k): safe_serialize(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple)):
            return [safe_serialize(i) for i in obj]
        else:
            return str(obj)

    return hashlib.md5(json.dumps(safe_serialize(args)).encode()).hexdigest()

def generate_prediction_grid(
    geeProject: str = None,
    country: str = None,
    points: list[tuple[float, float]] = None,
    interactions: list[dict] = None,
    selected_species: list[str] = None,
    occurrences: list[dict] = None,
    resolution_deg: float = RESOLUTION_DEG,
    user_grid: pd.DataFrame = None,
) -> pd.DataFrame:
    # Grid enviado pelo usuário (planilha com variáveis + lat/long cobrindo a
    # área de interesse). Nesse caso não buscamos nada do GEE nem recortamos
    # pelo shapefile do país — o grid é usado como veio; se a cobertura em
    # relação ao país selecionado é parcial, isso é responsabilidade do
    # usuário, não algo que o sistema tenta corrigir.
    if user_grid is not None and not user_grid.empty:
        grid_df = user_grid.reset_index(drop=True)
        print(f"Grid enviado pelo usuário: {len(grid_df)} pontos, {len(grid_df.columns)} colunas.")

        run_interactions = bool(interactions and selected_species)
        if run_interactions:
            grid_df = fetch_interaction_presence(grid_df, interactions, selected_species)

        return grid_df.copy()

    cache_key = _hash_args(country, points, interactions, selected_species, occurrences, resolution_deg)

    if cache_key in _GRID_CACHE:
        print("Grid carregado do cache.")
        return _GRID_CACHE[cache_key].copy()

    if country:
        grid_df = get_country_grid(country_name=country, resolution_deg=resolution_deg)
    else:
        grid_df = generate_grid_points(points=points, resolution_deg=resolution_deg)

    run_interactions = bool(interactions and selected_species)

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_env = executor.submit(fetch_env_indices, grid_df.copy(), geeProject, occurrences)

        future_interact = (
            executor.submit(fetch_interaction_presence, grid_df.copy(), interactions, selected_species)
            if run_interactions else None
        )

        env_df = future_env.result()

        if future_interact:
            interact_df = future_interact.result()
            new_cols = [c for c in interact_df.columns if c not in env_df.columns]
            grid_df = pd.concat([env_df.reset_index(drop=True), interact_df[new_cols].reset_index(drop=True)], axis=1)
        else:
            grid_df = env_df

    print(f"Grid final: {len(grid_df)} pontos com {len(grid_df.columns)} variáveis.")

    _GRID_CACHE[cache_key] = grid_df
    return grid_df.copy()