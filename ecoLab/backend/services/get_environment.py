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

    # O ecoenv usa a data de ocorrência para consultar imagens Sentinel. A
    # coluna é opcional no upload, portanto use a data atual como referência
    # quando ela não estiver disponível ou não puder ser interpretada.
    fallback_date = pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%d")
    if "eventDate" not in df.columns:
        df["eventDate"] = fallback_date
    else:
        dates = pd.to_datetime(df["eventDate"], errors="coerce", utc=True)
        df["eventDate"] = dates.dt.strftime("%Y-%m-%d").fillna(fallback_date)

    geometry = [Point(lon, lat) for lat, lon in zip(df[lat_col], df[lon_col])]
    return gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")


ENV_COLUMNS = ("NDVI", "NDWI", "tavg", "prec")
_KEY = ["_lat_key", "_lon_key", "eventDate"]


def _with_keys(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["_lat_key"] = pd.to_numeric(df["latitude"], errors="coerce").round(6)
    df["_lon_key"] = pd.to_numeric(df["longitude"], errors="coerce").round(6)
    df["eventDate"] = pd.to_datetime(df["eventDate"], errors="coerce", utc=True).dt.strftime("%Y-%m-%d")
    return df


def _attach_env_to_input(base: pd.DataFrame, env: pd.DataFrame) -> pd.DataFrame:
    """
    Devolve TODAS as linhas e colunas de entrada (espécie, id, ...) com as
    variáveis ambientais anexadas pela coordenada + data.

    O ecoenv, quando busca Sentinel (NDVI/NDWI) e WorldClim juntos, devolve só
    latitude/longitude/data + variáveis e remove pontos repetidos: a coluna de
    espécie sumia (e com ela o filtro por espécie) e espécies no mesmo ponto
    viravam uma linha só. O cache do Sentinel também é indexado só por
    coordenada/data, então linhas vindas do cache podiam trazer a espécie de
    outro registro. Por isso aqui só aproveitamos as colunas de variáveis.
    """
    env_cols = [c for c in ENV_COLUMNS if c in env.columns]
    out = base.drop(columns=[c for c in ENV_COLUMNS if c in base.columns], errors="ignore")
    if env.empty or not env_cols:
        return out
    left = _with_keys(out)
    right = _with_keys(env[["latitude", "longitude", "eventDate", *env_cols]])
    for c in env_cols:
        right[c] = pd.to_numeric(right[c], errors="coerce")
    right = right.groupby(_KEY, dropna=False)[env_cols].mean().reset_index()
    merged = left.merge(right, on=_KEY, how="left")
    merged = merged.drop(columns=["_lat_key", "_lon_key"])
    merged["eventDate"] = out["eventDate"].to_numpy()  # mantém a data como veio
    for c in env_cols:
        filled = int(merged[c].notna().sum())
        print(f"  {c}: {filled}/{len(merged)} pontos com valor ({100 * filled / max(len(merged), 1):.0f}%)")
    return merged


def get_environment(env_variables: dict):
    data = env_variables.get("data", [])
    index = env_variables.get("index", [])
    gee_project = str(env_variables.get("geeProject", "")).strip()
    if not gee_project:
        raise ValueError("Informe o projeto do Google Earth Engine antes de buscar variáveis ambientais.")

    gdf = json_to_geodataframe(data)
    try:
        # Mesma composição para ocorrências e grid do mapa: sem data, o ecoenv
        # usa o período de referência (mediana 2019-2023 do Sentinel, sem
        # nuvem). Treino e predição precisam das mesmas variáveis; antes as
        # ocorrências usavam uma data e o grid outra.
        query = gdf.copy()
        query["eventDate"] = None
        with _EE_LOCK:
            ecoenv.autenticateEE(project=gee_project)
            result = ecoenv.get_environment_data(
                gdf=query,
                ndvi="ndvi" in index,
                ndwi="ndwi" in index,
                temperature="temperature" in index,
                precipitation="precipitation" in index,
            )
        base = pd.DataFrame(gdf.drop(columns=["geometry"], errors="ignore"))
        if len(result) == len(base) and result.index.equals(gdf.index):
            # ecoenv >= 0.2: mesmas linhas, na mesma ordem
            for col in ENV_COLUMNS:
                if col in result.columns:
                    base[col] = pd.to_numeric(result[col], errors="coerce").to_numpy()
                    print(f"  {col}: {int(base[col].notna().sum())}/{len(base)} pontos com valor")
            result = base
        else:  # ecoenv antigo: devolve só coordenada + variáveis
            result = _attach_env_to_input(base, result.drop(columns=["geometry"], errors="ignore"))
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
