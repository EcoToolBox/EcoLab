import math
import os
import ecoInteract
import numpy as np
import pandas as pd
import ecoobs
from scipy.stats import gaussian_kde

# ─── Interações ───────────────────────────────────────────────────────────────

def _fit_kde(coords_df: pd.DataFrame):
    """
    Ajusta um KDE 2D (longitude, latitude) nas ocorrências do interator.
    Retorna None quando não há pontos suficientes/distintos pra estimar uma
    densidade (gaussian_kde exige >=2 pontos e covariância não-singular).
    """
    pts = coords_df[["longitude", "latitude"]].dropna().drop_duplicates()
    if len(pts) < 3:
        return None
    try:
        return gaussian_kde(pts.to_numpy().T)
    except np.linalg.LinAlgError:
        return None


def _kde_density(kde, lon: float, lat: float) -> float:
    if kde is None:
        return 0.0
    return float(kde(np.array([[lon], [lat]]))[0])


# Quantos interatores (os com mais ocorrências) entram como variável por espécie.
MAX_INTERACTORS_PER_SPECIES = int(os.environ.get("ECOLAB_MAX_INTERACTORS", "10") or 10)


def _normalize_name(name) -> str:
    return " ".join(str(name).replace("\u00a0", " ").split()).casefold()


def _match_interactor(names: pd.Series, interactor: str) -> pd.Series:
    """
    Linhas cujo nome científico é o interator. O GBIF devolve o nome com autor
    ("Caesalpinia pyramidalis Tul."), então comparar por igualdade exata não
    casava nada e a densidade do interator ficava 0 em todo lugar. Aqui vale o
    nome igual ou o nome seguido de mais palavras (autor, subespécie); para um
    gênero ("Malpighia"), todas as espécies dele.
    """
    target = _normalize_name(interactor)
    if not target:
        return pd.Series(False, index=names.index)
    norm = names.map(_normalize_name)
    return (norm == target) | norm.str.startswith(target + " ")

def _ensure_default_gbif_credentials():
    """
    A busca de ocorrências das espécies interatoras (abaixo) é interna: o
    usuário não escolhe fonte pra ela, ela reaproveita `selectedSources` da
    busca principal. Quando o modo de ocorrência é só "planilha própria", o
    usuário nunca marcou nenhuma fonte (não precisa, não está usando fontes
    externas pra si mesmo) — aí gbif/specieslink/inaturalist ficam todos False
    e o ecoobs recusa a busca com "At least one data source must be included.".

    Nesse caso caímos pro GBIF por padrão. As credenciais vêm de variável de
    ambiente do servidor (nunca hardcoded aqui), e só são salvas se ainda não
    existir nenhuma configurada (ex.: o próprio usuário já autenticou antes).
    """
    try:
        if ecoobs.gbif_key_exists():
            return
    except Exception:
        pass

    email = os.environ.get("ECOLAB_GBIF_EMAIL")
    user = os.environ.get("ECOLAB_GBIF_USER")
    password = os.environ.get("ECOLAB_GBIF_PASSWORD")
    if not (email and user and password):
        raise ValueError(
            "Nenhuma fonte de dados foi selecionada para buscar as ocorrências das "
            "espécies interatoras, e não há credenciais GBIF padrão configuradas no "
            "servidor. Defina ECOLAB_GBIF_EMAIL, ECOLAB_GBIF_USER e ECOLAB_GBIF_PASSWORD "
            "no ambiente (.env) ou autentique com o GBIF na etapa de Ocorrências."
        )
    ecoobs.save_gbif_credentials(email=email, user=user, password=password)

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
    if not (gbif or specieslink or inaturalist):
        gbif = True
        _ensure_default_gbif_credentials()
    radius_km = 50

    occurrences_df = pd.DataFrame(occurrences)
    selected_species_names = [s.get("name") for s in selected_species]
    interactor_map = _build_species_interactor_map(interactions_list, selected_species_names)

    if not interactor_map:
        result = occurrences_df.convert_dtypes().to_dict(orient="records")
        return _serialize(result)

    coordinates = []
    for record in occurrences:
        try:
            latitude = float(str(record.get("latitude", "")).replace(",", "."))
            longitude = float(str(record.get("longitude", "")).replace(",", "."))
        except (TypeError, ValueError):
            continue
        if -90 <= latitude <= 90 and -180 <= longitude <= 180:
            coordinates.append((latitude, longitude))

    if not coordinates:
        # Não tenta calcular min/max de uma lista vazia; mantém os dados
        # originais e deixa claro que não há como enriquecer as interações.
        return _serialize(occurrences_df.convert_dtypes().to_dict(orient="records"))

    lats = [lat for lat, _ in coordinates]
    lons = [lon for _, lon in coordinates]
    years = pd.to_numeric(pd.Series([r.get("year") for r in occurrences]), errors="coerce").dropna().astype(int).tolist()
    lat_margin = radius_km / 111.32
    lon_margin = max(
        radius_km / max(111.32 * abs(math.cos(math.radians(lat))), 0.01)
        for lat in lats
    )
    lat_min = min(lats) - lat_margin;  lat_max = max(lats) + lat_margin
    lon_min = min(lons) - lon_margin;  lon_max = max(lons) + lon_margin
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
        # O ano só restringe a busca; para o KDE (espacial) registros sem ano servem.
        all_occ_df = all_occ_df.dropna(subset=["latitude", "longitude", "scientificName"])
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

    # Coordenadas de todos os registros uma vez só (vetorizado)
    rec_lat = pd.to_numeric(occurrences_df.get("latitude", pd.Series(dtype=object)).astype(str)
                            .str.replace(",", ".", regex=False), errors="coerce")
    rec_lon = pd.to_numeric(occurrences_df.get("longitude", pd.Series(dtype=object)).astype(str)
                            .str.replace(",", ".", regex=False), errors="coerce")
    rec_valid = (rec_lat.between(-90, 90) & rec_lon.between(-180, 180)).to_numpy()
    rec_species = (occurrences_df[species_col].astype(str).str.casefold()
                   if species_col else pd.Series("", index=occurrences_df.index))
    name_cols = [c for c in ("scientificName", "species", "acceptedScientificName") if c in all_occ_df.columns]
    candidates = []
    skipped_no_data = 0

    for interactor, target_types_map in interactor_map.items():
        col_name    = interactor_col_names[interactor]
        match = pd.Series(False, index=all_occ_df.index)
        for c in name_cols:
            match |= _match_interactor(all_occ_df[c], interactor)
        species_occ = all_occ_df[match]
        relevant_targets = set(target_types_map.keys())
        covers_all = relevant_targets >= set(selected_species_names)

        # KDE puramente espacial: ajustado em cima de TODAS as ocorrências do
        # interator encontradas na bbox (já restrita com margem de radius_km
        # ao redor das ocorrências alvo), sem filtrar por ano. A densidade
        # avaliada em cada ponto alvo reflete só a concentração espacial das
        # observações do interator ali perto.
        kde = _fit_kde(species_occ)
        if kde is None:
            # Menos de 3 pontos distintos do interator na área: a coluna seria
            # toda zero e não ajuda o modelo (só pesa na resposta).
            skipped_no_data += 1
            continue

        # Linhas que recebem valor: coordenada válida e (se o interator não
        # vale para todas as espécies) a espécie da linha é um dos alvos.
        use = rec_valid.copy()
        if not covers_all and species_col:
            targets = [t.lower() for t in relevant_targets]
            use &= rec_species.map(lambda sp: any(t in sp for t in targets)).to_numpy()

        if not use.any():
            skipped_no_data += 1
            continue
        dens = np.full(len(occurrences_df), np.nan)
        if use.any():
            # Uma chamada para todos os pontos (antes era uma por ponto)
            dens[use] = kde(np.vstack([rec_lon.to_numpy()[use], rec_lat.to_numpy()[use]]))

        # Normaliza pra [0, 1] (densidade relativa dentro desse interator) —
        # mantém a escala comparável entre interatores com volumes de
        # ocorrência bem diferentes.
        peak = np.nanmax(dens) if np.isfinite(dens).any() else 0.0
        if peak > 0:
            dens = dens / peak

        candidates.append((col_name, dens, len(species_occ), relevant_targets, covers_all))

    # Para cada espécie, só os interatores com mais ocorrências (os mais bem
    # amostrados). Com dezenas de espécies a busca trazia mais de mil colunas
    # e a resposta ficava grande demais para o navegador ("Failed to fetch").
    keep = set()
    for sp in selected_species_names:
        rel = [c for c in candidates if c[4] or sp in c[3]]
        rel.sort(key=lambda c: c[2], reverse=True)
        keep.update(c[0] for c in rel[:MAX_INTERACTORS_PER_SPECIES])
    new_cols = {name: dens for name, dens, *_ in candidates if name in keep}
    print(f"Interações: {len(candidates)} interatores com dados, {skipped_no_data} sem dados descartados; "
          f"mantidos {len(new_cols)} (até {MAX_INTERACTORS_PER_SPECIES} por espécie, os com mais ocorrências).")

    if new_cols:  # todas as colunas de uma vez (evita o DataFrame fragmentado)
        occurrences_df = pd.concat(
            [occurrences_df.drop(columns=[c for c in new_cols if c in occurrences_df.columns]),
             pd.DataFrame(new_cols, index=occurrences_df.index)],
            axis=1,
        )

    print(f"Interações: {len(new_cols)} colunas de densidade em {len(occurrences_df)} pontos.")
    base_cols = [c for c in occurrences_df.columns if c not in new_cols]
    result = _serialize(occurrences_df[base_cols].convert_dtypes().to_dict(orient="records"))
    # Densidades só nas linhas em que valem (as outras ficam ausentes em vez
    # de null), arredondadas: a resposta encolhe muito com várias espécies.
    for col, dens in new_cols.items():
        for i in np.flatnonzero(np.isfinite(dens)):
            result[i][col] = round(float(dens[i]), 4)
    return result


def _serialize(records: list) -> list:
    """Converte tipos numpy/pandas para tipos nativos do Python antes de retornar ao FastAPI."""
    return [
        {k: (None if pd.isna(v) else v.item() if hasattr(v, "item") else v)
         for k, v in row.items()}
        for row in records
    ]
