import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .services import get_observations, get_environment, get_interactions, get_models
app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
os.makedirs("maps", exist_ok=True)
app.mount("/maps", StaticFiles(directory="maps"), name="maps")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/api")
def get():
    return {"msg": "Hello World"}

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
async def search_occurrences(occurrences: OccurrencesDICT):
    result = get_observations.search(occurrences.dict())
    return {"msg": result}


@app.get("/api/occurrence/gbif/check-key")
async def check_keys():
    result = get_observations.check_gbif_key()
    return {"msg": result}

@app.get("/api/occurrence/specieslink/check-key")
async def check_keys():
    result = get_observations.check_specieslink_key()
    return {"msg": result}


#environment
@app.post("/api/environment/variables")
async def get_env_variables(env_variables: dict):
    result = get_environment.get_environment(env_variables)
    return {"msg": result}


@app.get("/api/environment/check-ee-keys")
async def check_ee_keys():
    result = get_environment.check_ee_keys()
    return {"msg": result}

@app.post("/api/environment/authenticate/{project}")
async def authenticate_ee(project: str):
    result = get_environment.authenticate_ee(project)
    return {"msg": result}


#interactions
@app.post("/api/interactions")
async def search_interactions(interactions: dict):
    result = get_interactions.search_interactions(interactions)
    return {"msg": result}

@app.post("/api/interactions/occurrence")
async def search_interactions_occurrences(interactions: dict):
    result = get_interactions.add_interaction_occurrence(interactions)
    return {"msg": result}



#models
@app.post("/api/models")
async def run_models(models: dict):
    result = get_models.run_models(models)
    return {"msg": result}