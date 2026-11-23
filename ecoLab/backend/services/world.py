"""
Países e contornos embutidos no EcoLab (Natural Earth 1:110m).

Antes a lista de países vinha da API do IBGE (no navegador) e o contorno dos
países era baixado do Natural Earth a cada mapa. Sem internet o usuário ficava
travado na escolha do país e o mapa final falhava. Agora tudo vem do arquivo
data/world_110m.geojson, que vai junto com o app.

O país pode ser informado pelo código ISO3 ("BRA"), pelo nome em inglês do
Natural Earth ("Brazil", "United States of America") ou pelo nome em português.
"""
from __future__ import annotations

import json
import unicodedata
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "world_110m.geojson"


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return " ".join(text.lower().split())


@lru_cache(maxsize=1)
def load_world():
    """GeoDataFrame com NAME (inglês), NAME_PT, ISO_A3 e geometry."""
    import geopandas as gpd

    return gpd.read_file(DATA_FILE)


def list_countries() -> list[dict]:
    world = load_world()
    rows = [
        {"iso3": r.ISO_A3, "name_en": r.NAME, "name_pt": r.NAME_PT}
        for r in world.itertuples()
    ]
    return sorted(rows, key=lambda r: _norm(r["name_pt"]))


def resolve_iso3(country) -> str | None:
    """Aceita ISO3, nome em inglês, nome em português ou o dict do frontend."""
    if isinstance(country, dict):
        for key in ("iso3", "ingles", "name_en", "label", "name_pt"):
            iso = resolve_iso3(country.get(key))
            if iso:
                return iso
        return None
    value = _norm(country)
    if not value:
        return None
    world = load_world()
    if len(value) == 3 and value.upper() in set(world["ISO_A3"]):
        return value.upper()
    for col in ("NAME", "NAME_PT"):
        hit = world[world[col].map(_norm) == value]
        if not hit.empty:
            return hit.iloc[0]["ISO_A3"]
    try:  # nomes alternativos ("Bolivia, Plurinational State of", "USA"...)
        import pycountry

        iso = pycountry.countries.lookup(str(country).strip()).alpha_3
    except LookupError:
        try:
            import pycountry

            iso = pycountry.countries.search_fuzzy(str(country).strip())[0].alpha_3
        except LookupError:
            return None
    return iso if iso in set(world["ISO_A3"]) else None


def country_shape(country):
    """GeoDataFrame só com o país pedido (vazio se não achar)."""
    world = load_world()
    iso = resolve_iso3(country)
    return world[world["ISO_A3"] == iso] if iso else world.iloc[0:0]


def iso2(country) -> str | None:
    iso = resolve_iso3(country)
    if not iso:
        return None
    try:
        import pycountry

        return pycountry.countries.get(alpha_3=iso).alpha_2
    except Exception:
        return {"XKX": "XK"}.get(iso)


def country_geojson(country) -> dict | None:
    shape = country_shape(country)
    if shape.empty:
        return None
    return json.loads(shape[["NAME", "NAME_PT", "ISO_A3", "geometry"]].to_json())
