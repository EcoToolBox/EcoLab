import numpy as np
import pandas as pd

EARTH_RADIUS_KM = 6371.0088


def _outside_buffer(pool: pd.DataFrame, presences: pd.DataFrame, buffer_km: float) -> pd.DataFrame:
    """Remove do pool os pontos a menos de buffer_km (distância geodésica) de alguma presença."""
    from sklearn.neighbors import BallTree

    pres = np.radians(presences[["latitude", "longitude"]].to_numpy(dtype=float))
    cand = np.radians(pool[["latitude", "longitude"]].to_numpy(dtype=float))
    dist, _ = BallTree(pres, metric="haversine").query(cand, k=1)
    return pool[dist[:, 0] * EARTH_RADIUS_KM >= buffer_km]


def build_presence_dataframe(
    grid_df: pd.DataFrame,
    occurrences,
    presence_col: str = "presence",
    background_ratio: float = 1.0,
    background_df: pd.DataFrame = None,
    exclusion_buffer_km: float = 0.0,
) -> pd.DataFrame:
    """
    Combina 100% das ocorrências válidas com pontos de background
    (pseudo-ausência) tirados do grid ambiental.

    Importante: esses pontos de background NÃO são "ausências reais" —
    são pontos de fundo (background) usados para contrastar com as
    presenças, como é padrão em SDM baseado em presença/background.

    background_ratio: quantos pontos de background por presença
        (padrão 1:1, genérico). Para reproduzir um estudo específico
        (ex.: razão 2:1 do artigo de referência), passe background_ratio=2.
    background_df: se fornecido, usa esse conjunto de background já
        pronto (ex.: background do artigo original) em vez de amostrar
        do grid ambiental gerado automaticamente.
    exclusion_buffer_km: não sorteia pseudo-ausências a menos dessa
        distância (km) de qualquer presença (ex.: Santos et al. 2022 usou
        10x a distância máxima de voo da abelha). 0 = sem buffer.
    """
    occ_df = pd.DataFrame(occurrences) if not isinstance(occurrences, pd.DataFrame) else occurrences.copy()
    if occ_df.empty:
        raise ValueError("Não há ocorrências para treinar o modelo.")
    if grid_df.empty and (background_df is None or background_df.empty):
        raise ValueError("Não há pontos de grade disponíveis para gerar o background.")

    required = {"latitude", "longitude"}
    if not required.issubset(occ_df.columns):
        raise ValueError("Ocorrências precisam conter latitude e longitude.")

    occ_df["latitude"] = pd.to_numeric(occ_df["latitude"], errors="coerce")
    occ_df["longitude"] = pd.to_numeric(occ_df["longitude"], errors="coerce")
    # Mantém 100% das ocorrências com coordenadas válidas — nenhuma presença
    # é descartada aqui.
    presence_df = occ_df.dropna(subset=["latitude", "longitude"]).copy()
    if presence_df.empty:
        raise ValueError("Não há ocorrências com coordenadas válidas para treinar o modelo.")
    presence_df[presence_col] = 1

    n_presence = len(presence_df)
    n_background_target = max(1, round(background_ratio * n_presence))

    provided = background_df is not None and not background_df.empty
    if provided:
        # Background já fornecido (ex.: pontos originais de um estudo/artigo).
        # Usamos TODOS os pontos exatamente como vieram: o próprio arquivo
        # já define a razão presença/background, então background_ratio é
        # ignorado aqui (reamostrar mudaria o conjunto do estudo original).
        pool = background_df.copy()
        pool["latitude"] = pd.to_numeric(pool["latitude"], errors="coerce")
        pool["longitude"] = pd.to_numeric(pool["longitude"], errors="coerce")
        pool = pool.dropna(subset=["latitude", "longitude"])
        n_background_target = len(pool)
        source = "background fornecido"
    else:
        if grid_df.empty:
            raise ValueError("Não há pontos de grade disponíveis para gerar o background.")
        pool = grid_df.copy()
        pool["latitude"] = pd.to_numeric(pool["latitude"], errors="coerce")
        pool["longitude"] = pd.to_numeric(pool["longitude"], errors="coerce")
        pool = pool.dropna(subset=["latitude", "longitude"])

        # Evita reaproveitar como background pontos que coincidem com
        # ocorrências reais.
        occ_keys = pd.MultiIndex.from_arrays(
            [presence_df["latitude"].round(5), presence_df["longitude"].round(5)]
        )
        pool_keys = pd.MultiIndex.from_arrays([pool["latitude"].round(5), pool["longitude"].round(5)])
        pool = pool[~pool_keys.isin(occ_keys)]
        source = "grid aleatório"

        if exclusion_buffer_km and exclusion_buffer_km > 0 and not pool.empty:
            before = len(pool)
            pool = _outside_buffer(pool, presence_df, float(exclusion_buffer_km))
            print(f"Buffer de exclusão de {exclusion_buffer_km:g} km: {before - len(pool)} pontos removidos do pool.")
            source = f"grid aleatório fora de {exclusion_buffer_km:g} km das presenças"

    if pool.empty:
        raise ValueError("Não há pontos de background disponíveis fora das ocorrências.")

    n_background = min(n_background_target, len(pool))
    if n_background < n_background_target:
        print(
            f"Aviso: pool de background ({source}) tem só {len(pool)} pontos; "
            f"desejado {n_background_target} (razão {background_ratio}:1)."
        )

    if provided:
        background_sample = pool.copy()
    else:
        background_sample = pool.sample(n=n_background, random_state=42).copy()
    background_sample[presence_col] = 0

    keep_cols = list(dict.fromkeys(list(grid_df.columns) + list(pool.columns)))
    if provided:
        # As variáveis ambientais do background fornecido vêm nas próprias
        # linhas (herdadas da planilha); garantimos que as presenças também
        # mantenham as colunas que existirem nelas.
        keep_cols = list(dict.fromkeys(keep_cols + list(presence_df.columns)))
    keep_cols = [c for c in keep_cols if c != presence_col] + [presence_col]
    presence_df = presence_df[[column for column in keep_cols if column in presence_df.columns]]
    background_sample = background_sample[[column for column in keep_cols if column in background_sample.columns]]

    print(
        f"Presença/background: {n_presence} presenças, {n_background} background "
        f"({source}, razão {n_background / n_presence:.2f}:1)."
    )

    result = pd.concat([presence_df, background_sample], ignore_index=True)
    return result.sample(frac=1, random_state=42).reset_index(drop=True)
