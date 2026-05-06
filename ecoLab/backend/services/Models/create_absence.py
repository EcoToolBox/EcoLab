import pandas as pd 

def build_presence_dataframe(
    grid_df: pd.DataFrame,
    occurrences: list[dict],
    presence_col: str = "presence",
) -> pd.DataFrame:
    """
    Combina ocorrências reais com pontos do grid para criar dataset de presença/ausência.
    
    - 20% das ocorrências reais  → presence = 1
    - 80% de pontos do grid que não são ocorrências → presence = 0
    """
    occ_df = pd.DataFrame(occurrences) if not isinstance(occurrences, pd.DataFrame) else occurrences.copy()

    n_presence = max(1, int(len(occ_df) * 0.2))
    presence_df = occ_df.sample(n=n_presence, random_state=42).copy()
    presence_df[presence_col] = 1

    grid_cols = grid_df.columns.tolist()

    occ_coords = set(zip(occ_df["latitude"].astype(float).round(5), occ_df["longitude"].astype(float).round(5)))
    grid_filtered = grid_df[
        ~grid_df.apply(lambda r: (round(r["latitude"], 5), round(r["longitude"], 5)) in occ_coords, axis=1)
    ]

    n_absence = len(occ_df) - n_presence
    absence_df = grid_filtered.sample(n=min(n_absence, len(grid_filtered)), random_state=42).copy()
    absence_df[presence_col] = 0

    keep_cols = grid_cols + [presence_col]

    presence_df = presence_df[[c for c in keep_cols if c in presence_df.columns]]
    absence_df = absence_df[[c for c in keep_cols if c in absence_df.columns]]

    result = pd.concat([presence_df, absence_df], ignore_index=True).sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"Dataset gerado: {n_presence} presenças + {len(absence_df)} ausências = {len(result)} registros.")
    return result