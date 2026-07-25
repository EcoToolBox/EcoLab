from pydantic import BaseModel
from typing import Optional

REQUIRED_OCCURRENCE_FIELDS = {
    "species": True,
    "latitude": True,
    "longitude": True,
    "eventDate": False,
    "individualCount": False,
}

REQUIRED_ENVIRONMENT_FIELDS = {
    "latitude": True,
    "longitude": True,
}


class ColumnMapping(BaseModel):
    # {"species": "nome_cientifico", "latitude": "lat", "longitude": "lon", "eventDate": "data"}
    mapping: dict[str, str]


class EnvVariableMapping(BaseModel):
    column: str
    name: str


class EnvColumnMapping(BaseModel):
    # {"latitude": "lat", "longitude": "lon"}
    mapping: dict[str, str]
    variables: list[EnvVariableMapping]
