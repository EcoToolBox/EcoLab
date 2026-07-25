import csv
import io
import numpy as np
import pandas as pd

ALLOWED_EXTENSIONS = {"csv", "tsv", "txt", "xlsx", "xls"}


def _read_spreadsheet(file_bytes: bytes, filename: str) -> pd.DataFrame:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Formato de arquivo não suportado: .{ext}")

    if ext in ("xlsx", "xls"):
        # requires openpyxl (xlsx) / xlrd (legacy xls) to be installed
        return pd.read_excel(io.BytesIO(file_bytes))

    # O cabeçalho não deve conter vírgulas decimais; por isso ele é a fonte mais
    # confiável para descobrir o separador. Usar o arquivo inteiro faria o
    # Sniffer confundir a vírgula decimal com um delimitador.
    text = file_bytes.decode("utf-8-sig", errors="replace")
    header = next((line for line in text.splitlines() if line.strip()), "")
    try:
        delimiter = csv.Sniffer().sniff(header, delimiters=";,\t").delimiter
    except csv.Error:
        counts = {candidate: header.count(candidate) for candidate in (";", "\t", ",")}
        delimiter = max(counts, key=counts.get)
        if counts[delimiter] == 0:
            raise ValueError("Não foi possível identificar o separador das colunas.")

    return pd.read_csv(io.StringIO(text), sep=delimiter, engine="python")


def _parse_coordinate(series: pd.Series) -> pd.Series:
    """Aceita coordenadas com ponto ou vírgula decimal, inclusive texto do Excel."""
    values = series.astype("string").str.strip()
    values = values.str.replace(" ", "", regex=False)
    # Coordenadas não usam separador de milhar. Se vierem dos formatos
    # brasileiros, a vírgula é necessariamente o separador decimal.
    values = values.str.replace(",", ".", regex=False)
    return pd.to_numeric(values, errors="coerce")


def _validate_coordinates(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    errors = []
    df["latitude"] = _parse_coordinate(df["latitude"])
    df["longitude"] = _parse_coordinate(df["longitude"])

    invalid_mask = (
        df["latitude"].isna() | df["longitude"].isna()
        | (df["latitude"] < -90) | (df["latitude"] > 90)
        | (df["longitude"] < -180) | (df["longitude"] > 180)
    )
    n_invalid = int(invalid_mask.sum())
    if n_invalid:
        errors.append(
            f"{n_invalid} linha(s) descartada(s) por latitude/longitude ausente ou fora do intervalo válido."
        )

    return df[~invalid_mask].reset_index(drop=True), errors


def _to_records(df: pd.DataFrame) -> list[dict]:
    # mirrors the NaN/inf -> None handling used in get_environment.py so the
    # payload is always JSON-serializable
    df = df.replace([np.nan, np.inf, -np.inf], None)
    return df.to_dict(orient="records")


def parse_occurrence_upload(file_bytes: bytes, filename: str, mapping: dict) -> dict:
    """
    mapping: {"species": "<col>", "latitude": "<col>", "longitude": "<col>", "eventDate": "<col>"}
    Only entries with a non-empty column name are used; the rest are ignored.
    """
    try:
        df = _read_spreadsheet(file_bytes, filename)
    except Exception as e:
        return {"success": False, "errors": [f"Não foi possível ler o arquivo: {str(e)}"], "data": []}

    mapped_fields = {field: col for field, col in mapping.items() if col}

    missing_cols = [col for col in mapped_fields.values() if col not in df.columns]
    if missing_cols:
        return {
            "success": False,
            "errors": [f"Coluna(s) não encontrada(s) na planilha: {', '.join(missing_cols)}"],
            "data": [],
        }

    rename_map = {col: field for field, col in mapped_fields.items()}
    df = df.rename(columns=rename_map)[list(mapped_fields.keys())]

    if "species" in df.columns:
        df = df[df["species"].notna() & (df["species"].astype(str).str.strip() != "")]

    df, coord_errors = _validate_coordinates(df)
    df["source"] = "user_upload"

    return {
        "success": True,
        "errors": coord_errors,
        "imported": len(df),
        "data": _to_records(df),
    }


def parse_environment_upload(file_bytes: bytes, filename: str, mapping: dict, variables: list[dict]) -> dict:
    """
    mapping: {"latitude": "<col>", "longitude": "<col>"}
    variables: [{"column": "<col in the spreadsheet>", "name": "<name used by the models>"}, ...]
    """
    try:
        df = _read_spreadsheet(file_bytes, filename)
    except Exception as e:
        return {"success": False, "errors": [f"Não foi possível ler o arquivo: {str(e)}"], "data": []}

    lat_col = mapping.get("latitude")
    lon_col = mapping.get("longitude")
    var_columns = [v.get("column") for v in variables if v.get("column")]

    missing_cols = [c for c in [lat_col, lon_col, *var_columns] if c and c not in df.columns]
    if missing_cols:
        return {
            "success": False,
            "errors": [f"Coluna(s) não encontrada(s) na planilha: {', '.join(missing_cols)}"],
            "data": [],
        }

    var_rename = {v["column"]: v["name"] for v in variables if v.get("column") and v.get("name")}
    if len(set(var_rename.values())) != len(var_rename):
        return {
            "success": False,
            "errors": ["Duas ou mais variáveis foram nomeadas da mesma forma. Use nomes únicos."],
            "data": [],
        }

    keep_cols = [lat_col, lon_col, *var_rename.keys()]
    df = df[keep_cols].rename(columns={lat_col: "latitude", lon_col: "longitude", **var_rename})

    df, coord_errors = _validate_coordinates(df)
    variable_errors = []
    for variable in var_rename.values():
        df[variable] = _parse_coordinate(df[variable])
    if var_rename:
        invalid_variables = df[list(var_rename.values())].isna().any(axis=1)
        n_invalid_variables = int(invalid_variables.sum())
        if n_invalid_variables:
            variable_errors.append(
                f"{n_invalid_variables} linha(s) descartada(s) por variável ambiental ausente ou não numérica."
            )
            df = df[~invalid_variables].reset_index(drop=True)
    df["source"] = "user_upload"

    errors = coord_errors + variable_errors
    if df.empty:
        return {
            "success": False,
            "errors": errors or ["Nenhuma linha válida foi encontrada na planilha ambiental."],
            "imported": 0,
            "data": [],
        }

    return {
        "success": True,
        "errors": errors,
        "imported": len(df),
        "data": _to_records(df),
    }
