import os
import json
import math
import traceback
from pathlib import Path
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from .constants import REQUIRED_OCCURRENCE_FIELDS, REQUIRED_ENVIRONMENT_FIELDS, ColumnMapping, EnvColumnMapping
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ValidationError
from .services import get_observations, get_environment, get_interactions, get_models, get_uploads, prediction_grid, raster_env, system_dialogs
from .services.Models import create_grid

# Carrega backend/.env (credenciais padrão como ECOLAB_GBIF_*, nunca commitadas
# — já está em .gitignore) antes de qualquer código que leia os.environ.
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")
app = FastAPI()

# Grades ambientais costumam ter muitas linhas; 20 MB rejeitava arquivos CSV
# perfeitamente normais. A leitura continua limitada para proteger o servidor.
UPLOAD_MAX_BYTES = 100 * 1024 * 1024  # 100 MB

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
os.makedirs("maps", exist_ok=True)
app.mount("/maps", StaticFiles(directory="maps"), name="maps")
import os

@app.get("/api/config")
def get_config():
    return {"port": int(os.environ.get("APP_PORT", 8000))}


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# SPECIES
@app.get("/api/autocomplete/")
def get_autocomplete(species_name:str):
    result = get_observations.get_autocomplete(species_name)
    return {"msg": result}

@app.get("/api/taxonomy/roots/")
def get_taxonomy():
    result = get_observations.get_kingdoms()
    return {"msg": result}

@app.get("/api/taxonomy/{key}/children")
def get_taxonomy_children(key: int, limit: int = 50, offset: int = 0):
    result = get_observations.get_children(key, limit, offset)
    return {"msg": result}


# Authentication
class GBIFAuth(BaseModel):
    email: str
    userId: str
    apiKey: str
    
@app.post("/api/occurrence/gbif/authenticate")
def authenticate_gbif(gbif: GBIFAuth):
    result = get_observations.authenticate_gbif(gbif.dict())
    return {"msg": result}

class SpeciesLinkAuth(BaseModel):
    apiKey: str
    
@app.post("/api/occurrence/specieslink/authenticate")
def authenticate_specieslink(specieslink: SpeciesLinkAuth):
    result = get_observations.authenticate_specieslink(specieslink.dict())
    return {"msg": result}



#occurrences 
class OccurrencesDICT(BaseModel):
    sources: list
    speciesList: list
    country: str
    year: tuple[int,int]
    points: list[tuple[float, float]]

@app.post("/api/occurrence/search")
def search_occurrences(occurrences: OccurrencesDICT):
    try:
        result = get_observations.search(occurrences.dict())
    except ValueError as exc:
        raise HTTPException(502, str(exc))
    return {"msg": result}


@app.get("/api/occurrence/gbif/check-key")
def check_keys():
    result = get_observations.check_gbif_key()
    return {"msg": result}

@app.get("/api/occurrence/specieslink/check-key")
def check_keys():
    result = get_observations.check_specieslink_key()
    return {"msg": result}


#environment
@app.post("/api/environment/variables")
def get_env_variables(env_variables: dict):
    try:
        result = get_environment.get_environment(env_variables)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    if not result.get("success"):
        raise HTTPException(502, result.get("message", "Falha ao buscar variáveis ambientais."))
    return {"msg": result}


@app.post("/api/environment/attach-grid")
def attach_environment_grid(payload: dict):
    """Anexa aos pontos de ocorrência as variáveis do ponto ambiental mais próximo."""
    occurrences = pd.DataFrame(payload.get("occurrences", []))
    grid = pd.DataFrame(payload.get("grid", []))
    if occurrences.empty or grid.empty:
        raise HTTPException(422, "Envie ocorrências e uma grade ambiental não vazias.")

    feature_cols = [
        column for column in grid.columns
        if column not in {"id", "latitude", "longitude", "eventDate", "geometry", "source"}
    ]
    if not feature_cols:
        raise HTTPException(422, "A planilha ambiental não contém nenhuma variável selecionada.")

    try:
        result = create_grid.attach_nearest_grid_features(occurrences, grid, feature_cols)
    except (KeyError, ValueError) as exc:
        raise HTTPException(422, f"Não foi possível associar a grade ambiental: {exc}")

    result = result.replace([np.nan, np.inf, -np.inf], None)
    return {"msg": result.to_dict(orient="records")}


@app.get("/api/environment/check-ee-keys")
def check_ee_keys():
    result = get_environment.check_ee_keys()
    return {"msg": result}

@app.post("/api/environment/authenticate/{project}")
def authenticate_ee(project: str):
    result = get_environment.authenticate_ee(project)
    if not result.get("success"):
        raise HTTPException(502, result.get("message", "Falha ao autenticar no Earth Engine."))
    return {"msg": result}


#interactions
@app.post("/api/interactions")
def search_interactions(interactions: dict):
    result = get_interactions.search_interactions(interactions)
    return {"msg": result}

@app.post("/api/interactions/occurrence")
def search_interactions_occurrences(interactions: dict):
    result = get_interactions.add_interaction_occurrence(interactions)
    return {"msg": result}

#models
@app.post("/api/models")
def run_models(models: dict):
    try:
        result = get_models.run_models(models)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    except Exception as exc:
        traceback.print_exc()  # erro completo no terminal do backend
        raise HTTPException(500, f"Não foi possível executar os modelos: {type(exc).__name__}: {exc}")
    return {"msg": _json_safe(result)}


def _json_safe(obj):
    """NaN/inf não são JSON válido (viram erro 500 na resposta): troca por None."""
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, np.generic):
        obj = obj.item()
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


# occurrence upload (user's own spreadsheet, mapped to the required fields on the frontend)
@app.post("/api/occurrence/upload")
async def upload_occurrences(file: UploadFile = File(...), mapping: str = Form(...)):
    try:
        mapping_dict = json.loads(mapping)
    except (TypeError, ValueError):
        raise HTTPException(400, "Campo 'mapping' inválido: envie um JSON válido.")

    try:
        ColumnMapping(mapping=mapping_dict)
    except ValidationError as e:
        raise HTTPException(422, f"Formato de mapeamento inválido: {str(e)}")

    missing = [
        field for field, required in REQUIRED_OCCURRENCE_FIELDS.items()
        if required and not mapping_dict.get(field)
    ]
    if missing:
        raise HTTPException(422, f"Mapeamento incompleto. Faltam: {', '.join(missing)}")

    content = await file.read(UPLOAD_MAX_BYTES + 1)
    if len(content) > UPLOAD_MAX_BYTES:
        raise HTTPException(413, "Arquivo muito grande.")

    # parse_occurrence_upload é CPU-bound (pandas) e demora segundos em planilhas
    # grandes; chamado direto aqui ele bloqueava o event loop do FastAPI inteiro
    # (nenhuma outra requisição era atendida nesse meio tempo, o que parecia um
    # travamento/crash do backend). run_in_threadpool joga isso numa thread.
    result = await run_in_threadpool(get_uploads.parse_occurrence_upload, content, file.filename, mapping_dict)
    return {"msg": result}


# environment upload (user's own spreadsheet with environmental variables)
@app.post("/api/environment/upload")
async def upload_environment(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    variables: str = Form(...),
):
    try:
        mapping_dict = json.loads(mapping)
        variables_list = json.loads(variables)
    except (TypeError, ValueError):
        raise HTTPException(400, "Campos 'mapping'/'variables' inválidos: envie JSON válido.")

    try:
        EnvColumnMapping(mapping=mapping_dict, variables=variables_list)
    except ValidationError as e:
        raise HTTPException(422, f"Formato de mapeamento inválido: {str(e)}")

    missing = [
        field for field, required in REQUIRED_ENVIRONMENT_FIELDS.items()
        if required and not mapping_dict.get(field)
    ]
    if missing:
        raise HTTPException(422, f"Mapeamento incompleto. Faltam: {', '.join(missing)}")
    if not variables_list:
        raise HTTPException(422, "Selecione ao menos uma variável ambiental.")

    content = await file.read(UPLOAD_MAX_BYTES + 1)
    if len(content) > UPLOAD_MAX_BYTES:
        raise HTTPException(413, "Arquivo muito grande.")

    result = await run_in_threadpool(
        get_uploads.parse_environment_upload, content, file.filename, mapping_dict, variables_list
    )
    return {"msg": result}


# prediction grid upload (regular grid covering the area, used only to draw the maps)
@app.post("/api/prediction-grid/upload")
async def upload_prediction_grid(file: UploadFile = File(...)):
    content = await file.read(UPLOAD_MAX_BYTES + 1)
    if len(content) > UPLOAD_MAX_BYTES:
        raise HTTPException(413, "Arquivo muito grande.")
    result = await run_in_threadpool(prediction_grid.save_prediction_grid, content, file.filename)
    if not result.get("success"):
        raise HTTPException(422, " ".join(result.get("errors", [])) or "Grid de predição inválido.")
    return {"msg": result}


# rasters (.tif) read straight from a folder on the user's machine (EcoLab runs locally)
class RasterFolder(BaseModel):
    folder: str
    files: list[str] | None = None


class RasterSample(RasterFolder):
    occurrences: list[dict]


class RasterGrid(RasterFolder):
    resolution: float = 0.1


@app.post("/api/rasters/scan")
def scan_rasters(payload: RasterFolder):
    try:
        result = raster_env.scan_folder(payload.folder)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return {"msg": result}


@app.post("/api/rasters/sample")
async def sample_rasters(payload: RasterSample):
    occurrences = pd.DataFrame(payload.occurrences)
    if occurrences.empty or not {"latitude", "longitude"}.issubset(occurrences.columns):
        raise HTTPException(422, "Envie ocorrências com latitude e longitude.")
    try:
        result = await run_in_threadpool(raster_env.sample_points, payload.folder, payload.files, occurrences)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    result = result.replace([np.nan, np.inf, -np.inf], None)
    return {"msg": result.to_dict(orient="records")}


@app.post("/api/rasters/grid")
async def raster_grid(payload: RasterGrid):
    """Monta o grid de predição a partir dos rasters e guarda no servidor (devolve gridId)."""
    try:
        grid = await run_in_threadpool(raster_env.build_grid, payload.folder, payload.files, payload.resolution)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    result = await run_in_threadpool(prediction_grid.save_prediction_grid_df, grid)
    return {"msg": result}


class FolderPick(BaseModel):
    initial: str | None = None


@app.post("/api/system/pick-folder")
async def pick_folder(payload: FolderPick):
    """Abre a janela nativa de seleção de pasta (Explorer no Windows) e devolve o caminho."""
    try:
        folder = await run_in_threadpool(system_dialogs.pick_folder, payload.initial)
    except RuntimeError as exc:
        raise HTTPException(500, str(exc))
    return {"msg": {"folder": folder}}
