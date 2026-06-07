import threading
import os
import sys
import ecoInteract
import pandas as pd
import ecoobs

# ─── Interações ───────────────────────────────────────────────────────────────

def search_interactions(interactions: dict):
    species = [s.get("name") for s in interactions.get("species", [])]
    depth = interactions.get("depth", 3)
    interaction_type = interactions.get("interaction_type", [])
    print(f"Searching interactions for species: {species}, depth: {depth}, interaction_type: {interaction_type}")
    try:
        result = ecoInteract.get_interaction_data_api(
            target_species=species,
            search_depth=depth,
            interaction_type=interaction_type
        )
        if result is None:
            return {"msg": []}
        edges = [
            {"source": u, "target": v, **data}
            for u, v, data in result.edges(data=True)
        ]
        return {"msg": edges}
    except Exception as e:
        return {"success": False, "message": f"Search failed: {str(e)}"}


def _build_species_interactor_map(interactions_list: list, selected_species_names: list) -> dict:
    mapping = {}
    for interaction in interactions_list:
        source = interaction.get("source")
        target = interaction.get("target")
        itype = interaction.get("type", "interacts")
        for selected in selected_species_names:
            if source == selected and target and target not in selected_species_names:
                mapping.setdefault(target, {}).setdefault(selected, set()).add(itype)
            elif target == selected and source and source not in selected_species_names:
                mapping.setdefault(source, {}).setdefault(selected, set()).add(itype)
    return mapping


def add_interaction_occurrence(interactions: dict, use_year: bool = True):
    occurrences = interactions.get("occurrence", [])
    selected_species = interactions.get("selectedSpecies", [])
    interactions_list = interactions.get("interactions", [])
    selected_sources = interactions.get("selectedSources", [])

    gbif = "gbif" in selected_sources
    specieslink = "specieslink" in selected_sources
    inaturalist = "inaturalist" in selected_sources
    radius_km = 50
    radius_deg = radius_km / 111

    occurrences_df = pd.DataFrame(occurrences)
    selected_species_names = [s.get("name") for s in selected_species]
    interactor_map = _build_species_interactor_map(interactions_list, selected_species_names)

    if not interactor_map:
        result = occurrences_df.convert_dtypes().to_dict(orient="records")
        return _serialize(result)

    lats  = [float(r.get("latitude"))  for r in occurrences if r.get("latitude")]
    lons  = [float(r.get("longitude")) for r in occurrences if r.get("longitude")]
    years = [r.get("year")             for r in occurrences if r.get("year")]
    lat_min = min(lats) - radius_deg;  lat_max = max(lats) + radius_deg
    lon_min = min(lons) - radius_deg;  lon_max = max(lons) + radius_deg
    year_min = year_max = None
    if use_year and years:
        year_min = min(years)
        year_max = max(years)

    try:
        all_occ_df = ecoobs.get_occurrences(
            species_names=list(interactor_map.keys()),
            year_range=(year_min, year_max) if year_min is not None else None,
            lat_min=lat_min, lat_max=lat_max,
            lon_min=lon_min, lon_max=lon_max,
            includeSpeciesLink=specieslink,
            includeGbif=gbif,
            includeInaturalist=inaturalist,
        )
        all_occ_df["latitude"]  = pd.to_numeric(all_occ_df["latitude"],  errors="coerce")
        all_occ_df["longitude"] = pd.to_numeric(all_occ_df["longitude"], errors="coerce")
        all_occ_df = all_occ_df.dropna(subset=["latitude", "longitude", "scientificName", "year"])
    except Exception as e:
        print(f"Erro ao buscar ocorrências: {e}")
        result = occurrences_df.convert_dtypes().to_dict(orient="records")
        return _serialize(result)

    interactor_col_names = {
        interactor: f"{interactor} ({', '.join(sorted(set().union(*tmap.values())))})"
        for interactor, tmap in interactor_map.items()
    }

    species_col = next(
        (c for c in ["species", "scientificName", "taxon", "name"] if c in occurrences_df.columns),
        None
    )

    for interactor, target_types_map in interactor_map.items():
        col_name    = interactor_col_names[interactor]
        species_occ = all_occ_df[all_occ_df["scientificName"].str.contains(interactor, case=False, na=False)]
        relevant_targets = set(target_types_map.keys())
        covers_all = relevant_targets >= set(selected_species_names)

        presences = []
        for record in occurrences:
            lat  = float(record.get("latitude"))
            lon  = float(record.get("longitude"))
            year = record.get("year")

            if lat is None or lon is None:
                presences.append(None)
                continue

            if not covers_all and species_col:
                row_species = record.get(species_col, "")
                if not any(t.lower() in str(row_species).lower() for t in relevant_targets):
                    presences.append(None)
                    continue

            nearby = species_occ[
                (species_occ["year"] == year) &
                (species_occ["latitude"].between(lat - radius_deg, lat + radius_deg)) &
                (species_occ["longitude"].between(lon - radius_deg, lon + radius_deg))
            ]
            presences.append(1 if not nearby.empty else 0)

        valid = sum(v for v in presences if v is not None)
        nas   = sum(v is None for v in presences)
        print(f"{col_name}: {valid} presenças ({nas} linhas N/A)")
        occurrences_df[col_name] = presences

    print(occurrences_df)
    result = occurrences_df.convert_dtypes().to_dict(orient="records")
    return _serialize(result)


def _serialize(records: list) -> list:
    """Converte tipos numpy/pandas para tipos nativos do Python antes de retornar ao FastAPI."""
    return [
        {k: (None if pd.isna(v) else v.item() if hasattr(v, "item") else v)
         for k, v in row.items()}
        for row in records
    ]