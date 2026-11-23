from .Models import gam, maxent, random_forest, svm, brt, create_absence, create_grid, create_model_maps, kde_target
from .Models import validation
from .Models.validation import set_tss_mode, set_test_size
from .Models.ensemble import build_weighted_ensemble
from .prediction_grid import load_prediction_grid
import os
import sys
import time
import numpy as np
import pandas as pd

MODEL_RUNNERS = {
    "gam": gam.run,
    "maxent": maxent.run,
    "random_forest": random_forest.run,
    "svm": svm.run,
    "brt": brt.run,
}
# Os mais demorados primeiro, para o paralelismo terminar mais cedo.
_MODEL_COST = {"gam": 0, "random_forest": 1, "svm": 2, "brt": 3, "maxent": 4}


def _run_model_task(task: dict):
    """Roda um modelo de uma espécie. Fica no nível do módulo para poder ir para outro processo."""
    random_forest.N_JOBS = task["inner_jobs"]
    set_tss_mode(task["tss_mode"])
    set_test_size(task.get("test_size", 0.2))
    started = time.perf_counter()
    try:
        kwargs = dict(validation_mode=task["validation_mode"], n_folds=task["n_folds"])
        if task.get("target") == "kde":
            result = kde_target.run(task["model"], task["data"], task["features"], task["metrics"], **kwargs)
        else:
            result = MODEL_RUNNERS[task["model"]](task["data"], task["features"], task["metrics"], **kwargs)
        error = None
    except Exception as exc:  # um modelo com erro não derruba os outros
        result, error = None, str(exc)
    elapsed = time.perf_counter() - started
    print(f"  [{task['species'] or 'espécie'}] {task['model']}: {'ok' if error is None else 'erro'} em {elapsed:.1f}s")
    return task["species"], task["model"], result, error


def _n_workers(n_tasks: int) -> int:
    env = os.environ.get("ECOLAB_N_JOBS")
    if env:
        try:
            return max(1, min(int(env), n_tasks))
        except ValueError:
            pass
    return max(1, min((os.cpu_count() or 2) - 1, n_tasks))


def _run_model_tasks(tasks: list[dict]) -> list:
    """
    Roda todas as combinações espécie x modelo de uma vez, em paralelo.

    Antes elas rodavam uma depois da outra, usando um núcleo (só o RF usava
    mais). Em processos separados (loky) cada modelo usa um núcleo de verdade.
    No app empacotado (PyInstaller) usamos threads, que são seguras lá.
    Defina ECOLAB_N_JOBS=1 para voltar ao modo sequencial.
    """
    tasks = sorted(tasks, key=lambda t: _MODEL_COST.get(t["model"], 9))
    n_jobs = _n_workers(len(tasks))
    started = time.perf_counter()
    if n_jobs <= 1:
        results = [_run_model_task({**t, "inner_jobs": -1}) for t in tasks]
    else:
        from joblib import Parallel, delayed

        backend = os.environ.get("ECOLAB_PARALLEL_BACKEND") or (
            "threading" if getattr(sys, "frozen", False) else "loky"
        )
        print(f"Rodando {len(tasks)} modelos em paralelo ({n_jobs} de uma vez, {backend}).")
        jobs = [{**t, "inner_jobs": 1} for t in tasks]
        try:
            results = Parallel(n_jobs=n_jobs, backend=backend)(delayed(_run_model_task)(t) for t in jobs)
        except Exception as exc:
            print(f"Paralelismo ({backend}) falhou: {exc}. Rodando em sequência.")
            results = [_run_model_task({**t, "inner_jobs": -1}) for t in tasks]
    print(f"Modelos concluídos em {time.perf_counter() - started:.1f}s.")
    return results


def _make_tasks(species, data, features, selected_models, selected_metrics, validation_mode, n_folds, tss_mode,
                target="binary"):
    return [
        {
            "species": species, "model": m, "data": data, "features": features,
            "metrics": selected_metrics, "validation_mode": validation_mode,
            "n_folds": n_folds, "tss_mode": tss_mode, "target": target,
            # lido aqui (no processo principal) porque os workers do loky não herdam o global
            "test_size": validation.TEST_SIZE,
        }
        for m in selected_models if m in MODEL_RUNNERS
    ]


def _drop_empty_features(df: pd.DataFrame, features: list[str]) -> list[str]:
    """
    Uma feature totalmente vazia (ex.: um índice ambiental como NDVI/NDWI que
    falhou ao buscar no GEE e ficou NaN em todas as linhas) faz o `_prepare`
    de cada modelo dropar 100% dos registros — ele exige todas as colunas
    preenchidas (dropna) — zerando o treino sem deixar claro o motivo
    ("Registros usados: 0" em todos os modelos). Filtramos essas features
    ANTES de chegar no modelo, avisando qual variável foi descartada e por quê.
    """
    usable = []
    for col in features:
        if col not in df.columns or df[col].notna().sum() == 0:
            print(f"  Aviso: variável '{col}' está vazia (nenhum valor encontrado) e foi descartada do treino.")
            continue
        usable.append(col)
    return usable


def _interaction_feature_cols(columns, interactionData: list[dict]) -> list[str]:
    """
    Identifica, entre as colunas de um DataFrame, quais vieram do
    enriquecimento de interações bióticas (ex.: "Myrsine lancifolia (eats)").

    As colunas de interação só existem nas ocorrências reais quando o
    enriquecimento foi aplicado nelas, mas o grid de background (via
    `fetch_interaction_presence`) sempre ganha essas colunas. Depois do
    concat em `create_absence.build_presence_dataframe`, isso deixa as
    linhas de presença com NaN nessas colunas — e o dropna de cada modelo
    descarta a linha inteira. Tratamos NaN aqui como "sem sinal registrado"
    (0), igual já acontecia no fluxo multi-espécie.
    """
    interaction_species = set()
    for i in interactionData or []:
        interaction_species.add(i.get("source"))
        interaction_species.add(i.get("target"))
    interaction_species.discard(None)
    interaction_species.discard("")
    if not interaction_species:
        return []
    return [c for c in columns if _interactor_of(c) in interaction_species]


def _interactor_of(column) -> str | None:
    """
    Nome da espécie interatora de uma coluna de interação, no formato
    "Myrsine lancifolia (eats)". Antes a comparação era "nome contido na
    coluna": um nó do GloBI com nome vazio ou de uma letra casava com todas
    as colunas e as variáveis ambientais sumiam do modelo.
    """
    text = str(column)
    if not text.endswith(")") or " (" not in text:
        return None
    return text.rsplit(" (", 1)[0].strip() or None


def _is_numeric_feature(df: pd.DataFrame, column) -> bool:
    """Só colunas numéricas viram variáveis (texto da planilha, como gênero ou autor, não)."""
    series = df[column]
    if pd.api.types.is_bool_dtype(series):
        return False
    if pd.api.types.is_numeric_dtype(series):
        return True
    converted = pd.to_numeric(series, errors="coerce")
    return converted.notna().sum() > 0 and converted.notna().sum() >= series.notna().sum() * 0.95


def _buffer_for(occ: pd.DataFrame, default_km: float) -> float:
    """Buffer de exclusão: usa a coluna bufferKm das ocorrências (por espécie), se houver."""
    if occ is not None and "bufferKm" in getattr(occ, "columns", []):
        vals = pd.to_numeric(occ["bufferKm"], errors="coerce").dropna()
        if not vals.empty:
            return float(vals.iloc[0])
    return default_km


def _coverage_warnings(grid: pd.DataFrame, occurrences: pd.DataFrame, limit: float = 0.2) -> list[str]:
    """Avisa quando uma variável do Earth Engine voltou vazia em boa parte do grid ou das ocorrências."""
    warnings = []
    for name, df in (("grid", grid), ("ocorrências", occurrences)):
        if df is None or df.empty:
            continue
        for col in ("NDVI", "NDWI", "tavg", "prec"):
            if col in df.columns:
                missing = float(pd.to_numeric(df[col], errors="coerce").isna().mean())
                if missing > limit:
                    msg = (f"{col}: {missing:.0%} dos pontos do {name} ficaram sem valor (falha ou ausência de "
                           f"imagem no Earth Engine); esses pontos são descartados ou a variável é ignorada.")
                    print("Aviso:", msg)
                    warnings.append(msg)
    return warnings


def _dedupe_presences(occ: pd.DataFrame, label: str = "") -> pd.DataFrame:
    """
    Uma presença por coordenada, ou por célula do grid quando as variáveis
    vêm do grid (coluna _cell): registros na mesma célula têm exatamente as
    mesmas variáveis, então repeti-los só infla as métricas.
    """
    if occ is None or occ.empty or not {"latitude", "longitude"}.issubset(occ.columns):
        return occ
    if CELL_COL in occ.columns and occ[CELL_COL].notna().any():
        keys = pd.DataFrame({"c": occ[CELL_COL].to_numpy()})
        what = "na mesma célula do grid"
    else:
        lat = pd.to_numeric(occ["latitude"].astype(str).str.replace(",", ".", regex=False), errors="coerce").round(5)
        lon = pd.to_numeric(occ["longitude"].astype(str).str.replace(",", ".", regex=False), errors="coerce").round(5)
        keys = pd.DataFrame({"a": lat.to_numpy(), "b": lon.to_numpy()})
        what = "na mesma coordenada"
    keep = ~keys.duplicated()
    if (~keep).any():
        print(f"  {label}: {int((~keep).sum())} registros repetidos {what} removidos ({int(keep.sum())} pontos únicos).")
    return occ[keep.to_numpy()]


CELL_COL = "_cell"
EE_ENV_COLUMNS = ("NDVI", "NDWI", "tavg", "prec")


def _presences_from_grid(occ: pd.DataFrame, grid: pd.DataFrame, max_cells_away: float = 1.5):
    """
    Dá a cada presença as variáveis do Earth Engine da célula do grid mais
    próxima (com valores), como numa extração de raster: treino, background e
    mapa passam a usar a mesma tabela.

    Presenças a mais de `max_cells_away` células de qualquer célula do grid
    estão fora da área de estudo (ex.: pontos fora do país): saem da análise,
    porque o background e o mapa não cobrem esse lugar.
    """
    from scipy.spatial import cKDTree

    warnings: list[str] = []
    env_cols = [c for c in EE_ENV_COLUMNS if c in grid.columns]
    if occ is None or occ.empty or not env_cols:
        return occ, warnings

    cells = grid.copy()
    cells["latitude"] = pd.to_numeric(cells["latitude"], errors="coerce")
    cells["longitude"] = pd.to_numeric(cells["longitude"], errors="coerce")
    for c in env_cols:
        cells[c] = pd.to_numeric(cells[c], errors="coerce")
    cells = cells.dropna(subset=["latitude", "longitude", *env_cols])
    if cells.empty:
        return occ, warnings

    occ = occ.copy()
    lat = pd.to_numeric(occ["latitude"].astype(str).str.replace(",", ".", regex=False), errors="coerce")
    lon = pd.to_numeric(occ["longitude"].astype(str).str.replace(",", ".", regex=False), errors="coerce")
    valid = (lat.notna() & lon.notna()).to_numpy()

    coords = cells[["latitude", "longitude"]].to_numpy(dtype=float)
    tree = cKDTree(coords)
    # Passo do grid: distância típica entre vizinhos
    step = float(np.median(tree.query(coords[: min(len(coords), 2000)], k=2)[0][:, 1])) if len(coords) > 1 else 1.0

    dist, idx = tree.query(np.column_stack([lat.to_numpy()[valid], lon.to_numpy()[valid]]), k=1)
    far = dist > max_cells_away * step

    before = {c: pd.to_numeric(occ[c], errors="coerce").to_numpy()[valid] for c in env_cols if c in occ.columns}
    for c in env_cols:
        vals = np.full(len(occ), np.nan)
        vals[valid] = cells[c].to_numpy()[idx]
        occ[c] = vals
    cell_ids = np.full(len(occ), np.nan)
    cell_ids[valid] = cells.index.to_numpy()[idx]
    occ[CELL_COL] = cell_ids

    for c, old in before.items():
        new = occ[c].to_numpy()[valid]
        ok = np.isfinite(old) & np.isfinite(new)
        if ok.any():
            print(f"  {c} das presenças: mediana na etapa Ambiente {np.median(old[ok]):.3f} "
                  f"-> no grid {np.median(new[ok]):.3f}")

    drop = np.zeros(len(occ), dtype=bool)
    drop[np.flatnonzero(valid)[far]] = True
    if drop.any():
        names = pd.Series("", index=occ.index, dtype=object)
        for c in (c for c in SPECIES_COL_CANDIDATES if c in occ.columns):
            col = occ[c].astype(object).where(occ[c].notna(), "").map(lambda v: str(v).strip())
            names = names.where(names != "", col)
        per_species = names[drop].replace("", "sem nome").value_counts()
        detail = ", ".join(f"{n} ({k})" for n, k in per_species.items())
        msg = (f"{int(drop.sum())} ocorrência(s) fora da área do mapa foram descartadas, "
               f"porque o background e o mapa não cobrem esse lugar: {detail}.")
        print("Aviso:", msg)
        warnings.append(msg)
        occ = occ[~drop]
    print(f"Variáveis ambientais das presenças tiradas do grid ({', '.join(env_cols)}), "
          f"passo do grid {step:.3f}°.")
    return occ, warnings


def _apply_kde_target(data: pd.DataFrame, kde_cfg: dict | None, label: str = "") -> pd.DataFrame:
    """Modo KDE: acrescenta a densidade das ocorrências (0-1) como variável resposta."""
    if not kde_cfg or not kde_cfg.get("enabled"):
        return data
    presences = data[pd.to_numeric(data["presence"], errors="coerce") == 1]
    data, bw = kde_target.add_kde_target(data, presences, float(kde_cfg.get("bandwidthKm") or 0))
    print(f"  {label} resposta = KDE (banda {bw:.1f} km)")
    return data


def _split_provided_background(df: pd.DataFrame):
    """
    Se as ocorrências vieram com a coluna `presence` (upload com mapeamento
    de presença) e há linhas com 0, separa essas linhas como background
    fornecido. Retorna (presenças, background_ou_None).

    É assim que reproduzimos estudos que já trazem o próprio background,
    como o target-group background do artigo de Singleton et al. (2024),
    em vez de sortear pontos aleatórios do grid ambiental.
    """
    if df is None or df.empty or "presence" not in df.columns:
        return df, None
    presence = pd.to_numeric(df["presence"], errors="coerce")
    bg_mask = presence == 0
    if not bg_mask.any():
        return df, None
    occ = df[presence == 1].copy()
    bg = df[bg_mask].copy()
    print(f"Background fornecido no upload: {len(occ)} presenças, {len(bg)} background (sem reamostragem).")
    return occ, bg


SPECIES_COL_CANDIDATES = ["species", "scientificName", "taxon", "name"]


def _row_species_names(df: pd.DataFrame, columns: list[str]) -> pd.Series:
    """
    Nome da espécie de cada linha, normalizado. Com bases + planilha ("Usar os
    dois"), as linhas das bases têm o nome em "scientificName" e as da planilha
    em "species": olhar uma coluna só descartava a outra fonte inteira.
    """
    names = pd.Series("", index=df.index, dtype=object)
    for c in columns:
        col = df[c].astype(object).where(df[c].notna(), "")
        col = col.map(lambda v: " ".join(str(v).lower().split()))
        names = names.where(names != "", col)
    return names


def _filter_by_species(df: pd.DataFrame, species_name: str | None, strict: bool = False) -> pd.DataFrame:
    """
    Mantém só as linhas da espécie selecionada. Permite subir uma planilha
    única com várias espécies (cada uma com suas presenças e seu background)
    e modelar cada espécie separadamente.

    strict=True (várias espécies na mesma rodada): sem coluna de espécie é
    erro, para nunca modelar uma espécie com as ocorrências de todas.
    """
    if df is None or df.empty or not species_name:
        return df
    species_cols = [c for c in SPECIES_COL_CANDIDATES if c in df.columns]
    if not species_cols:
        if strict:
            raise ValueError(
                "Os dados de ocorrência chegaram sem a coluna de espécie, então não dá para separar "
                f"as ocorrências de '{species_name}' das outras. Colunas recebidas: {list(df.columns)[:15]}"
            )
        return df
    target = " ".join(species_name.lower().split())
    names = _row_species_names(df, species_cols)
    # Nome exato OU nome seguido de autor/subespécie ("Melipona seminigra Friese, 1903",
    # "Melipona seminigra abunensis"). Antes o segundo caso só valia quando não havia
    # nenhuma linha com o nome exato, e a maioria dos registros era descartada.
    mask = (names == target) | names.str.startswith(target + " ", na=False)
    filtered = df[mask].copy()
    if filtered.empty:
        raise ValueError(f"Nenhuma linha da planilha corresponde à espécie '{species_name}'.")
    if len(filtered) < len(df):
        print(f"Filtro por espécie '{species_name}': {len(filtered)} de {len(df)} linhas.")
    return filtered


def _check_grid_features(grid: pd.DataFrame | None, features: list[str], fill_zero: list[str] | None = None):
    """Falha cedo (antes de treinar) se o grid de predição não tiver as variáveis do treino."""
    if grid is None:
        return
    fill_zero = set(fill_zero or [])
    missing = [f for f in features if f not in grid.columns and f not in fill_zero]
    if missing:
        raise ValueError(
            "O grid de predição não tem as mesmas variáveis usadas no treino. "
            f"Faltando no grid: {', '.join(missing)}. Os nomes das colunas precisam ser idênticos."
        )


def _with_interaction_cols(grid: pd.DataFrame | None, interaction_cols: list[str]) -> pd.DataFrame | None:
    """Interações bióticas não existem no grid enviado: 0 = sem interação registrada."""
    if grid is None or not interaction_cols:
        return grid
    grid = grid.copy()
    for col in interaction_cols:
        grid[col] = grid[col].fillna(0) if col in grid.columns else 0
    return grid


def _maybe_add_ensemble(results: dict, ensemble_cfg: dict, selected_metrics: list[str], errors: list[str]):
    """Acrescenta results["ensemble"] (média ponderada) se estiver habilitado."""
    if not ensemble_cfg or not ensemble_cfg.get("enabled"):
        return
    if len([k for k in results if k != "ensemble"]) < 2:
        errors.append("ensemble: precisa de pelo menos 2 modelos executados com sucesso.")
        return
    try:
        results["ensemble"] = build_weighted_ensemble(
            results, selected_metrics,
            weight_metric=ensemble_cfg.get("metric", "tss"),
            threshold=float(ensemble_cfg.get("threshold", 0) or 0),
        )
        if any(r.get("target") == "kde" for k, r in results.items() if k != "ensemble"):
            results["ensemble"]["target"] = "kde"
    except Exception as exc:  # o ensemble nunca deve derrubar os modelos individuais
        print(f"  Ensemble não gerado: {type(exc).__name__}: {exc}")
        errors.append(f"ensemble: {exc}")


def run_models(models: dict):
    selectedSpecies = models.get("selectedSpecies", [])
    interactionData = models.get("interactionData", [])
    geeProject      = models.get("geeProject", "")
    finalData       = models.get("finalData", [])
    modelsData      = models.get("modelsData", [])
    country         = models.get("country", [])
    points          = models.get("points", None)
    country         = country.get("ingles", None)
    envGridData     = models.get("envGridData", [])
    print("14")
    selected_models  = modelsData.get("selectedModels", [])
    presence_type    = modelsData.get("presenceType", [])
    selected_metrics = modelsData.get("selectedMetrics", [])

    # Validação: aleatória (padrão, uso genérico) ou espacial (K-means por
    # coordenadas). backgroundRatio controla quantos pontos de background por
    # presença (padrão 2:1). backgroundSource é informativo: "grid_random"
    # usa o grid gerado automaticamente; "provided" reflete que o usuário
    # enviou sua própria planilha ambiental (envGridData), que já é usada
    # como grid/background quando presente.
    validation_mode  = modelsData.get("validationMode", "random")
    n_folds          = int(modelsData.get("nFolds", 10) or 10)
    background_ratio = float(modelsData.get("backgroundRatio", 2) or 2)
    background_source = modelsData.get("backgroundSource", "grid_random")
    if validation_mode not in ("random", "spatial", "repeated"):
        validation_mode = "random"
    if validation_mode == "repeated":
        # nFolds = número de repetições do split 80/20
        n_folds = int(modelsData.get("nRepeats", 5) or 5)
    background_buffer_km = float(modelsData.get("backgroundBufferKm", 0) or 0)
    tss_mode = modelsData.get("tssMode", "max")
    set_tss_mode(tss_mode)
    # Proporção de teste (%) nas validações aleatória e repetida; padrão 20%.
    test_size = set_test_size(modelsData.get("testSize", 20))
    if validation_mode in ("random", "repeated"):
        print(f"Proporção treino/teste: {round((1 - test_size) * 100)}% / {round(test_size * 100)}%")
    kde_cfg = modelsData.get("kdeTarget") or {}
    target = "kde" if kde_cfg.get("enabled") else "binary"

    # Grid de predição separado (opcional): se enviado, o modelo é treinado
    # com as ocorrências/background e aplicado neste grid para gerar o mapa.
    # Sem ele, o mapa continua sendo gerado no grid ambiental, como antes.
    prediction_grid_df = load_prediction_grid(modelsData.get("predictionGridId"))
    if prediction_grid_df is not None:
        print(f"Grid de predição enviado: {len(prediction_grid_df)} células (usado só no mapa).")

    selected_species_names = [s.get("name") for s in selectedSpecies] if selectedSpecies else []

    if isinstance(finalData, list):
        finalData = pd.DataFrame(finalData)

    user_grid_df = pd.DataFrame(envGridData) if envGridData else None
    # Variáveis vindas de rasters (.tif): não há planilha ambiental, e o grid
    # montado a partir dos rasters faz os dois papéis, fonte de background
    # (pseudo-ausências) e grid do mapa.
    if (user_grid_df is None or user_grid_df.empty) and prediction_grid_df is not None:
        user_grid_df = prediction_grid_df.copy()
        print("Sem planilha ambiental: usando o grid de predição também como fonte de background.")

    results = {}

    if not selected_models:
        raise ValueError("Selecione ao menos um modelo para executar.")
    if finalData.empty:
        raise ValueError("Não há dados de ocorrência para executar a modelagem.")
    if not country:
        raise ValueError("Selecione um país para gerar os mapas do modelo.")
    
    backgroundData = create_grid.generate_prediction_grid(
        geeProject, country, points,
        interactionData,
        selectedSpecies,
        finalData,
        user_grid=user_grid_df,
    )
    backgroundData = backgroundData.drop(columns=[c for c in ["geometry"] if c in backgroundData.columns])
    env_warnings = _coverage_warnings(backgroundData, finalData)

    # Colunas de interação (densidade dos interatores): as das ocorrências
    # passam a vir do MESMO grid usado no background e no mapa (célula mais
    # próxima). Antes eram calculadas à parte, com outra área e outra
    # normalização, e as presenças sempre ficavam com valores mais altos que
    # o background: o modelo separava os dois sem aprender nada (AUC 1,0).
    interaction_names = {n for i in (interactionData or []) for n in (i.get("source"), i.get("target")) if n}
    grid_interaction_cols = [
        c for c in backgroundData.columns
        if c in finalData.columns and "(" in c and any(n in c for n in interaction_names)
    ]
    if grid_interaction_cols:
        finalData = create_grid.attach_nearest_grid_features(finalData, backgroundData, grid_interaction_cols)
        print(f"Interações das ocorrências recalculadas a partir do grid: {len(grid_interaction_cols)} colunas.")
    # Colunas de interação que só existem nas ocorrências (o grid não tem):
    # ficariam 0 no background e o modelo separaria presença de ausência por
    # elas. Saem da análise.
    orphan_interaction_cols = [
        c for c in finalData.columns
        if c not in backgroundData.columns and "(" in c and any(n in c for n in interaction_names)
    ]
    if orphan_interaction_cols:
        finalData = finalData.drop(columns=orphan_interaction_cols)
        print(f"{len(orphan_interaction_cols)} colunas de interação sem correspondente no grid foram descartadas.")

    # Variáveis do Earth Engine (NDVI, NDWI, tavg, prec): as presenças passam a
    # usar o valor da MESMA célula do grid que o background e o mapa usam.
    # Antes vinham da etapa Ambiente (outra consulta, feita em outro momento) e,
    # se diferissem das do grid, o modelo separava presença de background por
    # essa diferença: AUC alto e mapa baixo justamente onde estão os pontos.
    if user_grid_df is None or user_grid_df.empty:
        finalData, area_warnings = _presences_from_grid(finalData, backgroundData)
        env_warnings.extend(area_warnings)

    # Quando o grid vem de uma planilha do usuário, as ocorrências (finalData)
    # não têm variáveis ambientais próprias. Herdamos os valores do ponto do
    # grid mais próximo de cada ocorrência, pra presença e ausência usarem as
    # mesmas variáveis no treino.
    if user_grid_df is not None and not user_grid_df.empty and not finalData.empty:
        grid_feature_cols = [
            c for c in backgroundData.columns
            if c not in {"latitude", "longitude", "eventDate", "geometry"}
        ]
        missing_in_final = [c for c in grid_feature_cols if c not in finalData.columns]
        if missing_in_final:
            finalData = create_grid.attach_nearest_grid_features(finalData, backgroundData, missing_in_final)

    not_features = {"eventDate", "latitude", "longitude", "geometry", "presence", "year",
                    "id", "country", "day", "month", "scientificName", "species", "taxon", "name", "source", "bufferKm", "presence_kde",
                    CELL_COL}
                                    
    # Com uma única espécie selecionada, a planilha pode conter várias
    # espécies: filtramos antes de montar presença/background.
    if len(selected_species_names) == 1:
        finalData = _filter_by_species(finalData, selected_species_names[0])

    if presence_type == "presence_only":
        features = [col for col in finalData.columns
                    if col not in not_features and _is_numeric_feature(finalData, col)]
        if not features:
            raise ValueError("Nenhuma variável ambiental foi encontrada para treinar o modelo.")

        # Presença/background: mantém 100% das ocorrências e amostra
        # background do grid ambiental na razão configurada (padrão 2:1).
        # Esses pontos de background NÃO são "ausências reais".
        occ_df, provided_bg = _split_provided_background(finalData)
        occ_df = _dedupe_presences(occ_df, selected_species_names[0] if selected_species_names else "")
        presence_only_df = create_absence.build_presence_dataframe(
            backgroundData, occ_df, background_ratio=background_ratio,
            background_df=provided_bg, exclusion_buffer_km=_buffer_for(occ_df, background_buffer_km),
        )
        for col in _interaction_feature_cols(presence_only_df.columns, interactionData):
            presence_only_df[col] = presence_only_df[col].fillna(0)
        features = _drop_empty_features(presence_only_df, features)
        if not features:
            raise ValueError("Todas as variáveis ambientais estão vazias para essas ocorrências.")
        interaction_cols = _interaction_feature_cols(features, interactionData)
        _check_grid_features(prediction_grid_df, features, fill_zero=interaction_cols)
        prediction_grid_df = _with_interaction_cols(prediction_grid_df, interaction_cols)
        if "maxent" not in selected_models:
            raise ValueError("MaxEnt deve ser selecionado para dados de presença apenas.")
        results["maxent"] = maxent.run(
            presence_only_df, features, selected_metrics,
            validation_mode=validation_mode, n_folds=n_folds,
        )
        maps = create_model_maps.generate_model_maps(
            results,
            prediction_grid_df if prediction_grid_df is not None else backgroundData,
            presence_only_df, country,
            species_name=selected_species_names[0] if selected_species_names else None,
        )
        return maps
        
    if len(selected_species_names) <= 1:
        print("83")
        occ_df, provided_bg = _split_provided_background(finalData)
        occ_df = _dedupe_presences(occ_df, selected_species_names[0] if selected_species_names else "")
        data_with_absences = create_absence.build_presence_dataframe(
            backgroundData, occ_df, background_ratio=background_ratio,
            background_df=provided_bg, exclusion_buffer_km=_buffer_for(occ_df, background_buffer_km),
        )
        for col in _interaction_feature_cols(data_with_absences.columns, interactionData):
            data_with_absences[col] = data_with_absences[col].fillna(0)
        features = [col for col in data_with_absences.columns
                    if col not in not_features and _is_numeric_feature(data_with_absences, col)]
        features = _drop_empty_features(data_with_absences, features)
        if not features:
            raise ValueError("Nenhuma variável ambiental foi encontrada para treinar o modelo.")
        interaction_cols = _interaction_feature_cols(features, interactionData)
        _check_grid_features(prediction_grid_df, features, fill_zero=interaction_cols)
        prediction_grid_df = _with_interaction_cols(prediction_grid_df, interaction_cols)
        model_errors = []
        data_with_absences = _apply_kde_target(data_with_absences, kde_cfg)
        tasks = _make_tasks(None, data_with_absences, features, selected_models,
                            selected_metrics, validation_mode, n_folds, tss_mode, target)
        for _, model, result, error in _run_model_tasks(tasks):
            if error is None:
                results[model] = result
            else:
                print(f"  Erro ao rodar {model}: {error}")
                model_errors.append(f"{model}: {error}")
        results = {m: results[m] for m in selected_models if m in results}

        if not results:
            raise ValueError("Nenhum modelo pôde ser executado. " + " | ".join(model_errors))
        _maybe_add_ensemble(results, modelsData.get("ensemble"), selected_metrics, model_errors)

        maps = create_model_maps.generate_model_maps(
            results,
            prediction_grid_df if prediction_grid_df is not None else backgroundData,
            data_with_absences,
            country,
            species_name=selected_species_names[0] if selected_species_names else None,
        )
        return {"maps": maps, "warnings": env_warnings + model_errors}

    species_col = None
    for candidate in ["species", "scientificName", "taxon", "name"]:
        if candidate in finalData.columns:
            species_col = candidate
            break

    interaction_columns = set()
    for i in interactionData:
        interaction_columns.add(i.get("source"))
        interaction_columns.add(i.get("target"))
    interaction_columns.discard(None)
    interaction_columns.discard("")

    interaction_col_candidates = []
    env_only_cols = []
    ignored_cols = []
    for c in finalData.columns:
        if c in not_features:
            continue
        if _interactor_of(c) in interaction_columns:
            interaction_col_candidates.append(c)
        elif _is_numeric_feature(finalData, c):
            env_only_cols.append(c)
        else:
            ignored_cols.append(c)
    if ignored_cols:
        env_warnings.append(
            "Colunas de texto ignoradas como variáveis: " + ", ".join(map(str, ignored_cols[:12]))
            + ("…" if len(ignored_cols) > 12 else "") + "."
        )

    def _prepare_species(species_name):
        """Fase 1 de uma espécie: filtra as ocorrências e monta presenças + pseudo-ausências."""
        species_finalData = _filter_by_species(finalData, species_name, strict=True)
        species_interaction_cols = []
        for i in interaction_col_candidates:
            for j in interactionData:
                if j.get("source") in i and j.get("target", "").lower() == species_name.lower():
                    species_interaction_cols.append(i)
                elif j.get("target") in i and j.get("source", "").casefold() == species_name.casefold():
                    species_interaction_cols.append(i)

        # A mesma coluna aparece uma vez por sentido da interação (ex.:
        # visitsFlowersOf e flowersVisitedBy): sem isso entrava repetida e o GAM quebrava.
        species_interaction_cols = list(dict.fromkeys(species_interaction_cols))
        features_for_species = list(dict.fromkeys(env_only_cols + species_interaction_cols))
        if not features_for_species:
            raise ValueError(
                f"Nenhuma variável ambiental ou de interação foi encontrada para {species_name}. "
                f"Colunas recebidas: {', '.join(map(str, list(finalData.columns)[:20]))}. "
                "Confira se a etapa Ambiente foi concluída depois da última busca de ocorrências."
            )

        # Cópia só quando a espécie tem colunas de interação para preencher
        # (o grid pode ter centenas de milhares de linhas).
        bg_for_species = backgroundData.copy() if species_interaction_cols else backgroundData
        species_occ, species_provided_bg = _split_provided_background(species_finalData)
        species_occ = _dedupe_presences(species_occ, species_name)
        n_pres = len(species_occ)
        if n_pres < 5:
            raise ValueError(f"só {n_pres} ponto(s) de ocorrência diferentes; são necessários pelo menos 5.")
        if n_pres < 25:
            all_warnings.append(
                f"{species_name}: só {n_pres} pontos de ocorrência diferentes. Com tão poucos, o teste tem "
                f"{max(1, round(n_pres * 0.2))} presença(s) e AUC/TSS podem dar 1,0 por acaso; trate as métricas com cautela."
            )
        data_with_absences = create_absence.build_presence_dataframe(
            grid_df=bg_for_species, occurrences=species_occ,
            background_ratio=background_ratio,
            background_df=species_provided_bg,
            exclusion_buffer_km=_buffer_for(species_occ, background_buffer_km),
        )
        features_for_species = _drop_empty_features(data_with_absences, features_for_species)
        if not features_for_species:
            raise ValueError(f"Nenhuma variável ambiental ou de interação utilizável foi encontrada para {species_name}.")
        _check_grid_features(prediction_grid_df, features_for_species, fill_zero=species_interaction_cols)

        for col in species_interaction_cols:
            if col in data_with_absences.columns:
                data_with_absences[col] = data_with_absences[col].fillna(0)
            # O grid de predição também precisa dessas colunas de interação
            # (0 = sem interação registrada nessa célula), já que ele é
            # usado diretamente para prever em cada célula do grid.
            if col not in bg_for_species.columns:
                bg_for_species[col] = 0
            else:
                bg_for_species[col] = bg_for_species[col].fillna(0)
        if "species" not in data_with_absences.columns:
            data_with_absences["species"] = species_name
        data_with_absences = _apply_kde_target(data_with_absences, kde_cfg, species_name)
        return (species_name, data_with_absences, features_for_species,
                species_interaction_cols, bg_for_species)

    all_maps = {}
    all_warnings = list(env_warnings)
    prepared = []  # Fase 1: dados de cada espécie (presenças + pseudo-ausências)

    if species_col is None:  # sem coluna de espécie não dá para separar nenhuma
        _filter_by_species(finalData, selected_species_names[0], strict=True)

    for species_name in selected_species_names:
        print(f"\n{'='*60}\nModelando espécie: {species_name}\n{'='*60}")
        try:
            prepared_species = _prepare_species(species_name)
        except ValueError as exc:
            # Espécie sem ocorrências (ou sem dados utilizáveis) vira aviso e as
            # outras continuam; antes derrubava a rodada inteira (erro 422).
            print(f"  {species_name} ignorada: {exc}")
            all_warnings.append(f"{species_name}: {exc}")
            continue
        if prepared_species is not None:
            prepared.append(prepared_species)

    if not prepared:
        raise ValueError("Nenhuma espécie tem dados suficientes para modelar. " + " | ".join(all_warnings))

    # Fase 2: todos os modelos de todas as espécies de uma vez, em paralelo.
    tasks = []
    for species_name, data_with_absences, features_for_species, _, _ in prepared:
        tasks += _make_tasks(species_name, data_with_absences, features_for_species, selected_models,
                             selected_metrics, validation_mode, n_folds, tss_mode, target)
    by_species = {name: ({}, []) for name, *_ in prepared}
    for species_name, model, result, error in _run_model_tasks(tasks):
        if error is None:
            by_species[species_name][0][model] = result
        else:
            print(f"  Erro ao rodar {model} para {species_name}: {error}")
            by_species[species_name][1].append(f"{model}: {error}")

    # Fase 3: ensemble e mapas de cada espécie.
    for species_name, data_with_absences, features_for_species, species_interaction_cols, bg_for_species in prepared:
        species_results, model_errors = by_species[species_name]
        species_results = {m: species_results[m] for m in selected_models if m in species_results}
        if not species_results:
            # Uma espécie sem nenhum modelo não derruba as outras.
            all_warnings.append(
                f"{species_name}: nenhum modelo pôde ser executado. " + " | ".join(model_errors)
            )
            continue
        _maybe_add_ensemble(species_results, modelsData.get("ensemble"), selected_metrics, model_errors)
        all_warnings.extend(f"{species_name}: {error}" for error in model_errors)

        if prediction_grid_df is not None:
            map_grid = _with_interaction_cols(prediction_grid_df, species_interaction_cols)
        else:
            map_grid = bg_for_species
        species_maps = create_model_maps.generate_model_maps(
            species_results, map_grid, data_with_absences, country,
            species_name=species_name,
        )

        for model_key, map_data in species_maps.items():
            all_maps[f"{model_key}::{species_name}"] = map_data

    if not all_maps:
        raise ValueError("Nenhum modelo pôde ser executado. " + " | ".join(all_warnings))
    return {"maps": all_maps, "warnings": all_warnings}
