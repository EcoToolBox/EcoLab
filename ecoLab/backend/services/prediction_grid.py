"""
Grid de predição enviado pelo usuário.

Separa os dois papéis que antes eram feitos pela mesma planilha ambiental:
  - treino: ocorrências + background (com as variáveis nos pontos);
  - predição/mapa: um grid regular cobrindo a área inteira, com as mesmas
    variáveis, onde o modelo treinado é aplicado célula a célula.

O grid costuma ter dezenas de milhares de linhas, então ele não vai pelo
estado do frontend: o upload salva o grid no servidor e devolve um id, que
a tela de Modelos envia em modelsData.predictionGridId.
"""
from __future__ import annotations

import os
import uuid

import numpy as np
import pandas as pd

from .get_uploads import _read_spreadsheet, _parse_coordinate

GRID_DIR = "prediction_grids"

_LAT_ALIASES = ("latitude", "lat", "y", "decimallatitude")
_LON_ALIASES = ("longitude", "lon", "long", "lng", "x", "decimallongitude")


def _find_column(columns, aliases):
    lookup = {str(c).strip().lower(): c for c in columns}
    for alias in aliases:
        if alias in lookup:
            return lookup[alias]
    return None


def _grid_path(grid_id: str) -> str:
    # o id é um uuid gerado aqui; validamos para não aceitar caminhos arbitrários
    uuid.UUID(grid_id)
    return os.path.join(GRID_DIR, f"{grid_id}.pkl")


def save_prediction_grid(file_bytes: bytes, filename: str) -> dict:
    try:
        df = _read_spreadsheet(file_bytes, filename)
    except Exception as exc:
        return {"success": False, "errors": [f"Não foi possível ler o arquivo: {exc}"]}

    lat_col = _find_column(df.columns, _LAT_ALIASES)
    lon_col = _find_column(df.columns, _LON_ALIASES)
    if lat_col is None or lon_col is None:
        return {
            "success": False,
            "errors": ["O grid precisa ter colunas de latitude e longitude (ex.: 'latitude' e 'longitude')."],
        }

    df = df.rename(columns={lat_col: "latitude", lon_col: "longitude"})
    df["latitude"] = _parse_coordinate(df["latitude"])
    df["longitude"] = _parse_coordinate(df["longitude"])
    df = df.dropna(subset=["latitude", "longitude"])

    variables = []
    for col in df.columns:
        if col in ("latitude", "longitude"):
            continue
        values = _parse_coordinate(df[col])  # aceita vírgula decimal
        if values.notna().any():
            df[col] = values
            variables.append(col)
    df = df[["latitude", "longitude", *variables]].reset_index(drop=True)

    if df.empty or not variables:
        return {"success": False, "errors": ["O grid não tem linhas válidas ou variáveis numéricas."]}
    return save_prediction_grid_df(df)


def save_prediction_grid_df(df: pd.DataFrame) -> dict:
    """Guarda um grid já pronto (latitude, longitude + variáveis) e devolve o id."""
    variables = [c for c in df.columns if c not in ("latitude", "longitude")]
    os.makedirs(GRID_DIR, exist_ok=True)
    grid_id = str(uuid.uuid4())
    df.to_pickle(_grid_path(grid_id))

    return {
        "success": True,
        "errors": [],
        "gridId": grid_id,
        "rows": int(len(df)),
        "variables": variables,
        "bounds": {
            "latMin": float(df["latitude"].min()), "latMax": float(df["latitude"].max()),
            "lonMin": float(df["longitude"].min()), "lonMax": float(df["longitude"].max()),
        },
    }


def load_prediction_grid(grid_id: str | None) -> pd.DataFrame | None:
    if not grid_id:
        return None
    try:
        path = _grid_path(str(grid_id))
    except ValueError:
        raise ValueError("Identificador do grid de predição inválido.")
    if not os.path.exists(path):
        raise ValueError(
            "O grid de predição enviado não foi encontrado no servidor "
            "(o EcoLab pode ter sido reiniciado). Envie o arquivo de novo na tela de Modelos."
        )
    return pd.read_pickle(path).replace([np.inf, -np.inf], np.nan)
