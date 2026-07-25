import threading

import ecoenv
import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point


# ecoenv mantém a autenticação no processo. Serializamos cada operação para
# impedir que duas requisições usem projetos diferentes ao mesmo tempo.
_EE_LOCK = threading.RLock()


def json_to_geodataframe(data: list[dict], lat_col="latitude", lon_col="longitude") -> gpd.GeoDataFrame:
    df = pd.DataFrame(data)
    if lat_col not in df.columns or lon_col not in df.columns:
        raise ValueError("Os dados precisam conter latitude e longitude.")

    df[lat_col] = pd.to_numeric(
        df[lat_col].astype(str).str.strip().str.replace(",", ".", regex=False),
        errors="coerce",
    )
    df[lon_col] = pd.to_numeric(
        df[lon_col].astype(str).str.strip().str.replace(",", ".", regex=False),
        errors="coerce",
    )
    df = df.dropna(subset=[lat_col, lon_col])
    df = df[df[lat_col].between(-90, 90) & df[lon_col].between(-180, 180)]
    if df.empty:
        raise ValueError("Nenhuma coordenada válida foi informada.")

    geometry = [Point(lon, lat) for lat, lon in zip(df[lat_col], df[lon_col])]
    return gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")


def get_environment(env_variables: dict):
    data = env_variables.get("data", [])
    index = env_variables.get("index", [])
    gee_project = str(env_variables.get("geeProject", "")).strip()
    if not gee_project:
        raise ValueError("Informe o projeto do Google Earth Engine antes de buscar variáveis ambientais.")

    gdf = json_to_geodataframe(data)
    try:
        with _EE_LOCK:
            ecoenv.autenticateEE(project=gee_project)
            result = ecoenv.get_environment_data(
                gdf=gdf,
                ndvi="ndvi" in index,
                ndwi="ndwi" in index,
                temperature="temperature" in index,
                precipitation="precipitation" in index,
            )
        result = result.drop(columns=["geometry"], errors="ignore")
        result = result.replace([np.nan, np.inf, -np.inf], None)
        return {"success": True, "msg": result.to_dict(orient="records")}
    except Exception as exc:
        return {"success": False, "message": f"Falha ao buscar variáveis ambientais: {exc}"}


def authenticate_ee(project: str):
    project = str(project).strip()
    if not project:
        return {"success": False, "message": "Informe o nome do projeto do Earth Engine."}
    try:
        with _EE_LOCK:
            auth_result = ecoenv.autenticateEE(project=project)
        return {"success": True, "message": "Authentication successful", "data": auth_result}
    except Exception as exc:
        return {"success": False, "message": f"Authentication failed: {exc}"}


def check_ee_keys():
    try:
        with _EE_LOCK:
            return ecoenv.check_ee_authenticated()
    except Exception as exc:
        return {"success": False, "message": f"Key check failed: {exc}"}
