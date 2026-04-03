from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .services import get_observations
app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

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
    
@app.post("/api/ocurrence/gbif/authenticate")
def authenticate_gbif(gbif: GBIFAuth):
    result = get_observations.authenticate_gbif(gbif.dict())
    return {"msg": result}

@app.post("api/ocurrence/specieslink/authenticate")
def authenticate_specieslink(specieslink: dict):
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
def search_occurrences(occureences: OccurrencesDICT):
    result = get_observations.search(occureences.dict())
    return {"msg": result}