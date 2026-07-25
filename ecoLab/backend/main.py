import os
import json
import numpy as np
import pandas as pd
from .constants import REQUIRED_OCCURRENCE_FIELDS, REQUIRED_ENVIRONMENT_FIELDS, ColumnMapping, EnvColumnMapping
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ValidationError
from .services import get_observations, get_environment, get_interactions, get_models, get_uploads
from .services.Models import create_grid
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
    except Exception:
        raise HTTPException(500, "Não foi possível executar os modelos. Verifique os dados e tente novamente.")
    return {"msg": result}


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

    result = get_uploads.parse_occurrence_upload(content, file.filename, mapping_dict)
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

    result = get_uploads.parse_environment_upload(content, file.filename, mapping_dict, variables_list)
    return {"msg": result}
