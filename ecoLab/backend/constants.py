from pydantic import BaseModel
from typing import Optional

REQUIRED_OCCURRENCE_FIELDS = {
    "species": True,
    "latitude": True,
    "longitude": True,
    "eventDate": False,
    "individualCount": False,
    # Opcional: coluna 0/1 indicando presença (1) ou background (0).
    # Quando mapeada e com linhas 0, essas linhas são usadas como o
    # background do modelo exatamente como vieram (ex.: reproduzir um artigo).
    "presence": False,
    # Opcional: buffer de exclusão das pseudo-ausências (km) por espécie
    "bufferKm": False,
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
