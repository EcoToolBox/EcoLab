import pandas as pd


def build_presence_dataframe(
    grid_df: pd.DataFrame,
    occurrences,
    presence_col: str = "presence",
    background_ratio: float = 1.0,
    background_df: pd.DataFrame = None,
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

    if background_df is not None and not background_df.empty:
        # Background já fornecido (ex.: pontos originais de um estudo/artigo).
        # Usamos como veio; se houver mais pontos do que a razão pede,
        # amostramos para respeitar background_ratio, mas nunca descartamos
        # presenças.
        pool = background_df.copy()
        pool["latitude"] = pd.to_numeric(pool["latitude"], errors="coerce")
        pool["longitude"] = pd.to_numeric(pool["longitude"], errors="coerce")
        pool = pool.dropna(subset=["latitude", "longitude"])
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
        occ_coords = set(zip(presence_df["latitude"].round(5), presence_df["longitude"].round(5)))
        pool = pool[
            ~pool.apply(lambda row: (round(row["latitude"], 5), round(row["longitude"], 5)) in occ_coords, axis=1)
        ]
        source = "grid aleatório"

    if pool.empty:
        raise ValueError("Não há pontos de background disponíveis fora das ocorrências.")

    n_background = min(n_background_target, len(pool))
    if n_background < n_background_target:
        print(
            f"Aviso: pool de background ({source}) tem só {len(pool)} pontos; "
            f"desejado {n_background_target} (razão {background_ratio}:1)."
        )

    background_sample = pool.sample(n=n_background, random_state=42).copy()
    background_sample[presence_col] = 0

    keep_cols = list(dict.fromkeys(list(grid_df.columns) + list(pool.columns))) + [presence_col]
    presence_df = presence_df[[column for column in keep_cols if column in presence_df.columns]]
    background_sample = background_sample[[column for column in keep_cols if column in background_sample.columns]]

    print(
        f"Presença/background: {n_presence} presenças, {n_background} background "
        f"({source}, razão {n_background / n_presence:.2f}:1)."
    )

    result = pd.concat([presence_df, background_sample], ignore_index=True)
    return result.sample(frac=1, random_state=42).reset_index(drop=True)
