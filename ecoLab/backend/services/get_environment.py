import ecoenv
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
import numpy as np

_initialized = False
_project = ""
def json_to_geodataframe(data: list[dict], lat_col="latitude", lon_col="longitude") -> gpd.GeoDataFrame:
    try: 
        df = pd.DataFrame(data)
        df[lat_col] = pd.to_numeric(df[lat_col].astype(float), errors="coerce")
        df[lon_col] = pd.to_numeric(df[lon_col].astype(float), errors="coerce")
        df = df.dropna(subset=[lat_col, lon_col])
    
        geometry = [Point(lon, lat) for lat, lon in zip(df[lat_col].astype(float), df[lon_col].astype(float))]
        return gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")
    except Exception as e:
        print(f"Erro ao converter JSON para GeoDataFrame: {str(e)}")
        raise


def get_environment(env_variables: dict):
    global _project, _initialized
    data = env_variables.get("data", [])
    index = env_variables.get("index", "")
    geeProject = env_variables.get("geeProject", "")
    
    _project = geeProject
    ensure_authenticated()
    precipitation = "precipitation" in index
    temperature = "temperature" in index
    ndvi = "ndvi" in index
    ndwi = "ndwi" in index

    gdf = json_to_geodataframe(data, lat_col="latitude", lon_col="longitude")
    print(f"Entrada {len(gdf)}")
    try:
        result = ecoenv.get_environment_data(
            gdf = gdf,
            ndvi = ndvi,
            ndwi = ndwi,
            temperature = temperature,
            precipitation = precipitation
        )
        cols_to_drop = ["geometry"]
        result = result.drop(columns=[c for c in cols_to_drop if c in result.columns])
        print(f"Após função {len(result)}")
        result = result.replace([np.nan, np.inf, -np.inf], None)
        return {"msg": result.to_dict(orient="records")}
    except Exception as e:
        return {"success": False, "msg": f"Search failed: {str(e)}"}
    


def authenticate_ee(project: str):
    global _project, _initialized
    try:
        auth_result = ecoenv.autenticateEE(project=project)
        _project = project
        _initialized = True
        print(f"Autenticado no projeto: {_project}")
        return {"success": True, "message": "Authentication successful", "data": auth_result}
    except Exception as e:
        _initialized = False
        return {"success": False, "message": f"Authentication failed: {str(e)}"}

def ensure_authenticated():
    global _initialized, _project
    if not _initialized:
        if _project is None:
            raise Exception("Earth Engine não autenticado. Chame authenticate_ee(project) primeiro.")
        ecoenv.autenticateEE(project=_project)
        _initialized = True

def check_ee_keys():
    try:
        return ecoenv.check_ee_authenticated()
    except Exception as e:
        return {"success": False, "message": f"Key check failed: {str(e)}"}