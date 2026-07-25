import pandas as pd


def build_presence_dataframe(
    grid_df: pd.DataFrame,
    occurrences: list[dict],
    presence_col: str = "presence",
) -> pd.DataFrame:
    """Combina todas as presenças válidas com pseudo-ausências do grid."""
    occ_df = pd.DataFrame(occurrences) if not isinstance(occurrences, pd.DataFrame) else occurrences.copy()
    if occ_df.empty:
        raise ValueError("Não há ocorrências para treinar o modelo.")
    if grid_df.empty:
        raise ValueError("Não há pontos de grade disponíveis para gerar pseudo-ausências.")

    required = {"latitude", "longitude"}
    if not required.issubset(occ_df.columns) or not required.issubset(grid_df.columns):
        raise ValueError("Ocorrências e grade precisam conter latitude e longitude.")

    occ_df["latitude"] = pd.to_numeric(occ_df["latitude"], errors="coerce")
    occ_df["longitude"] = pd.to_numeric(occ_df["longitude"], errors="coerce")
    presence_df = occ_df.dropna(subset=["latitude", "longitude"]).copy()
    if presence_df.empty:
        raise ValueError("Não há ocorrências com coordenadas válidas para treinar o modelo.")
    presence_df[presence_col] = 1

    grid_df = grid_df.copy()
    grid_df["latitude"] = pd.to_numeric(grid_df["latitude"], errors="coerce")
    grid_df["longitude"] = pd.to_numeric(grid_df["longitude"], errors="coerce")
    grid_df = grid_df.dropna(subset=["latitude", "longitude"])

    occ_coords = set(zip(presence_df["latitude"].round(5), presence_df["longitude"].round(5)))
    grid_filtered = grid_df[
        ~grid_df.apply(lambda row: (round(row["latitude"], 5), round(row["longitude"], 5)) in occ_coords, axis=1)
    ]
    if grid_filtered.empty:
        raise ValueError("A grade não possui pontos fora das ocorrências para gerar pseudo-ausências.")

    n_absence = min(len(presence_df), len(grid_filtered))
    absence_df = grid_filtered.sample(n=n_absence, random_state=42).copy()
    absence_df[presence_col] = 0

    keep_cols = grid_df.columns.tolist() + [presence_col]
    presence_df = presence_df[[column for column in keep_cols if column in presence_df.columns]]
    absence_df = absence_df[[column for column in keep_cols if column in absence_df.columns]]
    result = pd.concat([presence_df, absence_df], ignore_index=True)
    return result.sample(frac=1, random_state=42).reset_index(drop=True)
