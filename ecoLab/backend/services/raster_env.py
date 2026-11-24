"""
Variáveis ambientais a partir de rasters (.tif) numa pasta do computador.

O EcoLab roda localmente, então em vez de subir gigabytes por HTTP o usuário
informa a pasta e o backend lê os arquivos direto do disco.

Cada raster vira uma variável, com o nome do arquivo (sem extensão, e sem o
prefixo "wc2.1_30s_" dos arquivos do WorldClim). Os rasters podem ter CRS e
resoluções diferentes:
  - nas ocorrências, o valor é lido no pixel de cada ponto, na resolução
    original de cada raster (como num SDM feito em R com terra::extract);
  - no grid de predição, cada célula recebe o valor do pixel no seu centro
    (vizinho mais próximo), também na resolução original. Assim treino e
    predição usam valores do mesmo tipo. Fazer a média dos pixels dentro da
    célula quebraria variáveis como aspecto (ângulo), declividade e tipo de
    solo (categórica), que ficariam fora da faixa vista no treino.
"""
from __future__ import annotations

import os
import re

import numpy as np
import pandas as pd

# Leitor próprio (tifffile + pyproj), sem GDAL/rasterio: as DLLs da GDAL podem
# ser bloqueadas pelo Smart App Control do Windows.
from .geotiff import open_geotiff, transform_bounds

RASTER_EXTENSIONS = (".tif", ".tiff")
MAX_GRID_CELLS = 2_000_000


def variable_name(path: str) -> str:
    stem = os.path.splitext(os.path.basename(path))[0]
    stem = re.sub(r"^wc2\.1_[\d.]+[smd]_", "", stem)  # wc2.1_30s_bio_2 / wc2.1_2.5m_bio_2 -> bio_2
    return re.sub(r"[^0-9A-Za-z_]+", "_", stem).strip("_") or "var"


def _check_folder(folder: str) -> str:
    folder = os.path.abspath(os.path.expanduser(str(folder or "").strip().strip('"')))
    if not os.path.isdir(folder):
        raise ValueError(f"Pasta não encontrada: {folder}")
    return folder


def _resolve_files(folder: str, files: list[str] | None) -> list[str]:
    folder = _check_folder(folder)
    available = {f["relativePath"]: os.path.join(folder, f["relativePath"]) for f in scan_folder(folder)["files"]}
    if not files:
        return list(available.values())
    missing = [f for f in files if f not in available]
    if missing:
        raise ValueError(f"Arquivos não encontrados na pasta: {', '.join(missing)}")
    return [available[f] for f in files]


def scan_folder(folder: str) -> dict:
    """Lista os rasters da pasta (e subpastas) com CRS, resolução e extensão."""
    folder = _check_folder(folder)
    out, errors, names = [], [], {}
    for root, _, filenames in os.walk(folder):
        for fn in sorted(filenames):
            if not fn.lower().endswith(RASTER_EXTENSIONS):
                continue
            path = os.path.join(root, fn)
            rel = os.path.relpath(path, folder)
            try:
                with open_geotiff(path) as src:
                    b = transform_bounds(src.crs, src.bounds)
                    name = variable_name(path)
                    if name in names:
                        errors.append(f"'{rel}' e '{names[name]}' geram o mesmo nome de variável ({name}).")
                    names[name] = rel
                    out.append({
                        "relativePath": rel,
                        "variable": name,
                        "crs": src.crs.to_string() if src.crs else None,
                        "resolution": [float(src.res[0]), float(src.res[1])],
                        "width": src.width, "height": src.height,
                        "bounds": {"lonMin": b[0], "latMin": b[1], "lonMax": b[2], "latMax": b[3]},
                        "nodata": _json_nodata(src.nodata),
                        "sizeMB": round(os.path.getsize(path) / 1048576, 1),
                    })
            except Exception as exc:
                errors.append(f"Não foi possível abrir '{rel}': {exc}")
    if not out:
        errors.append("Nenhum arquivo .tif encontrado na pasta.")
    return {"folder": folder, "files": out, "errors": errors}


def _json_nodata(nodata):
    """nodata para a resposta JSON: NaN/infinito não existem em JSON."""
    if nodata is None:
        return None
    value = float(nodata)
    return value if np.isfinite(value) else str(value)


def _masked_float(arr: np.ndarray, nodata) -> np.ndarray:
    arr = arr.astype("float64")
    if nodata is not None and not np.isnan(nodata):
        arr[arr == nodata] = np.nan
    arr[~np.isfinite(arr)] = np.nan
    return arr


def _read_at(src, lon: np.ndarray, lat: np.ndarray, strip_rows: int = 512) -> np.ndarray:
    """
    Valor do pixel que contém cada ponto (lon/lat em EPSG:4326), na resolução
    original do raster. Lê o arquivo em faixas de linhas: não carrega o raster
    inteiro na memória e é bem mais rápido que src.sample para muitos pontos.
    Usada tanto nas ocorrências quanto no grid, para os dois receberem valores
    exatamente do mesmo jeito.
    """
    from pyproj import Transformer

    out = np.full(len(lon), np.nan)
    ok = np.isfinite(lon) & np.isfinite(lat)
    if not ok.any():
        return out
    xs, ys = lon[ok], lat[ok]
    if src.crs and src.crs.to_epsg() != 4326:
        xs, ys = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True).transform(xs, ys)
    rows, cols = src.rowcol(xs, ys)
    rows, cols = np.asarray(rows), np.asarray(cols)
    inside = (rows >= 0) & (rows < src.height) & (cols >= 0) & (cols < src.width)

    values = np.full(len(xs), np.nan)
    for r0 in range(0, src.height, strip_rows):
        m = inside & (rows >= r0) & (rows < r0 + strip_rows)
        if not m.any():
            continue
        n = min(strip_rows, src.height - r0)
        block = src.read_rows(r0, n)
        values[m] = block[rows[m] - r0, cols[m]]
    out[ok] = _masked_float(values, src.nodata)
    return out


def sample_points(folder: str, files: list[str] | None, points: pd.DataFrame) -> pd.DataFrame:
    """Anexa a cada ponto (latitude/longitude) o valor de cada raster no pixel do ponto."""

    df = points.copy()
    lat = pd.to_numeric(df["latitude"], errors="coerce").to_numpy(dtype="float64")
    lon = pd.to_numeric(df["longitude"], errors="coerce").to_numpy(dtype="float64")
    for path in _resolve_files(folder, files):
        with open_geotiff(path) as src:
            df[variable_name(path)] = _read_at(src, lon, lat)
    return df


def build_grid(folder: str, files: list[str] | None, resolution_deg: float = 0.1,
               bounds: dict | None = None) -> pd.DataFrame:
    """
    Grade regular em EPSG:4326 com todas as variáveis, lidas no pixel do
    centro de cada célula (igual à leitura nas ocorrências). Por padrão cobre a
    interseção das extensões dos rasters.
    """
    paths = _resolve_files(folder, files)
    resolution_deg = float(resolution_deg)
    if resolution_deg <= 0:
        raise ValueError("A resolução do grid precisa ser maior que zero.")

    if bounds:
        lon_min, lat_min, lon_max, lat_max = (bounds["lonMin"], bounds["latMin"], bounds["lonMax"], bounds["latMax"])
    else:
        lon_min, lat_min, lon_max, lat_max = -180.0, -90.0, 180.0, 90.0
        for path in paths:
            with open_geotiff(path) as src:
                b = transform_bounds(src.crs, src.bounds)
            lon_min, lat_min = max(lon_min, b[0]), max(lat_min, b[1])
            lon_max, lat_max = min(lon_max, b[2]), min(lat_max, b[3])
    if lon_min >= lon_max or lat_min >= lat_max:
        raise ValueError("Os rasters não se sobrepõem; não dá para montar um grid comum.")

    width = int(np.ceil((lon_max - lon_min) / resolution_deg))
    height = int(np.ceil((lat_max - lat_min) / resolution_deg))
    if width * height > MAX_GRID_CELLS:
        raise ValueError(
            f"Grid de {width}x{height} células é grande demais. Aumente a resolução "
            f"(ex.: {resolution_deg * 2:g}°) ou limite a área."
        )
    lons = lon_min + (np.arange(width) + 0.5) * resolution_deg
    lats = lat_max - (np.arange(height) + 0.5) * resolution_deg
    lon_mesh, lat_mesh = np.meshgrid(lons, lats)
    data = {"latitude": np.round(lat_mesh.ravel(), 6), "longitude": np.round(lon_mesh.ravel(), 6)}

    # Cada célula recebe o valor do pixel original no seu centro, com a mesma
    # função usada nas ocorrências: treino e predição ficam consistentes.
    for path in paths:
        with open_geotiff(path) as src:
            data[variable_name(path)] = _read_at(src, data["longitude"], data["latitude"])
        print(f"  grid: {variable_name(path)} lido")

    grid = pd.DataFrame(data)
    before = len(grid)
    grid = grid.dropna().reset_index(drop=True)
    print(f"Grid dos rasters: {len(grid)} células com todas as variáveis (de {before}).")
    if grid.empty:
        raise ValueError("Nenhuma célula tem valor em todos os rasters (verifique nodata/extensão).")
    return grid
