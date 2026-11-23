import re
import csv
import io
import numpy as np
import pandas as pd

ALLOWED_EXTENSIONS = {"csv", "tsv", "txt", "xlsx", "xls"}


def _read_spreadsheet(file_bytes: bytes, filename: str, usecols: list[str] | None = None) -> pd.DataFrame:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Formato de arquivo não suportado: .{ext}")

    # usecols restringe a leitura só às colunas que o mapeamento realmente usa.
    # Numa planilha de ocorrência típica (20+ colunas) isso já corta boa parte
    # do tempo de parsing, porque nem os valores das colunas descartadas
    # chegam a ser convertidos para o DataFrame.
    if ext in ("xlsx", "xls"):
        # requires openpyxl (xlsx) / xlrd (legacy xls) to be installed
        try:
            return pd.read_excel(io.BytesIO(file_bytes), usecols=usecols)
        except ValueError:
            # alguma coluna de 'usecols' não existe no arquivo: lê tudo e deixa
            # o caller reportar quais colunas estão faltando.
            if usecols is not None:
                return pd.read_excel(io.BytesIO(file_bytes))
            raise

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

    # engine="python" era usado sem necessidade: o Sniffer sempre devolve um
    # delimitador de um único caractere, e o engine C do pandas (o padrão)
    # lida com isso tranquilamente sendo muito mais rápido — a diferença é
    # brutal em planilhas de dezenas de milhares de linhas como essa.
    try:
        return pd.read_csv(
            io.StringIO(text), sep=delimiter, usecols=usecols, low_memory=False
        )
    except ValueError:
        if usecols is not None:
            return pd.read_csv(io.StringIO(text), sep=delimiter, low_memory=False)
        raise


def _parse_coordinate(series: pd.Series) -> pd.Series:
    """Aceita coordenadas com ponto ou vírgula decimal, inclusive texto do Excel."""
    # astype(str) (objeto Python puro) é bem mais rápido aqui que o dtype
    # "string" (StringDtype) do pandas, que tem overhead de boxing por valor.
    values = series.astype(str).str.strip()
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


_PRESENCE_VALUES = {
    "1": 1, "1.0": 1, "true": 1, "presence": 1, "presenca": 1, "presença": 1, "p": 1,
    "0": 0, "0.0": 0, "false": 0, "background": 0, "absence": 0, "ausencia": 0, "ausência": 0, "bg": 0,
}


def _parse_presence(series: pd.Series) -> tuple[pd.Series, list[str]]:
    """Converte a coluna de presença para 1 (presença) / 0 (background); valores inválidos viram NaN."""
    parsed = series.astype(str).str.strip().str.lower().map(_PRESENCE_VALUES)
    n_invalid = int(parsed.isna().sum())
    errors = []
    if n_invalid:
        errors.append(
            f"{n_invalid} linha(s) descartada(s) por valor de presença inválido (use 1 para presença e 0 para background)."
        )
    return parsed, errors


_DATE_FORMATS = (
    "%d/%m/%Y", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d-%m-%Y",
    "%Y/%m/%d", "%Y-%m", "%m/%Y",
)


def _parse_event_date(series: pd.Series) -> tuple[pd.Series, list[str]]:
    """
    Normaliza a coluna de data para AAAA-MM-DD, aceitando os formatos comuns:
    ISO com ou sem hora ("2022-04-27T09:25:21", "2022-04-27"), dia/mês/ano
    ("27/04/2022") e só o ano ("2001" ou 2001.0, vira 2001-01-01).
    Datas que não forem reconhecidas ficam vazias (com aviso), sem descartar a linha.
    """
    text = series.astype(object).where(series.notna(), None).map(
        lambda v: None if v is None else str(v).strip()
    )
    text = text.where(text.map(lambda v: bool(v)), None)
    # Intervalo ISO ("2015-06-01/2015-06-03", como o GBIF exporta): usa o início.
    text = text.map(lambda v: v.split("/")[0] if v and re.match(r"^\d{4}-\d{2}", v) and "/" in v else v)
    parsed = pd.to_datetime(text, format="ISO8601", errors="coerce", utc=True)
    for fmt in _DATE_FORMATS:
        missing = parsed.isna() & text.notna()
        if not missing.any():
            break
        parsed = parsed.where(~missing, pd.to_datetime(text[missing], format=fmt, errors="coerce", utc=True))
    # Só o ano (inteiro ou número com .0)
    missing = parsed.isna() & text.notna()
    if missing.any():
        years = pd.to_numeric(text[missing], errors="coerce")
        ok = years.notna() & (years % 1 == 0) & years.between(1700, 2100)
        if ok.any():
            parsed.loc[ok[ok].index] = pd.to_datetime(
                years[ok].astype(int).astype(str) + "-01-01", format="%Y-%m-%d", utc=True
            )
    result = parsed.dt.strftime("%Y-%m-%d").where(parsed.notna(), None)
    errors = []
    n_bad = int((parsed.isna() & text.notna()).sum())
    if n_bad:
        examples = ", ".join(sorted(set(text[parsed.isna() & text.notna()].astype(str)))[:3])
        errors.append(
            f"{n_bad} data(s) não reconhecida(s) e deixada(s) em branco (ex.: {examples}). "
            "Use AAAA-MM-DD, DD/MM/AAAA ou só o ano."
        )
    return result, errors


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
    mapped_fields = {field: col for field, col in mapping.items() if col}
    wanted_cols = list(dict.fromkeys(mapped_fields.values())) or None

    try:
        df = _read_spreadsheet(file_bytes, filename, usecols=wanted_cols)
    except Exception as e:
        return {"success": False, "errors": [f"Não foi possível ler o arquivo: {str(e)}"], "data": []}

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

    presence_errors = []
    if "presence" in df.columns:
        df["presence"], presence_errors = _parse_presence(df["presence"])
        df = df[df["presence"].notna()].reset_index(drop=True)
        df["presence"] = df["presence"].astype(int)

    if "bufferKm" in df.columns:
        df["bufferKm"] = pd.to_numeric(df["bufferKm"], errors="coerce")

    date_errors = []
    if "eventDate" in df.columns:
        df["eventDate"], date_errors = _parse_event_date(df["eventDate"])
        df["year"] = pd.to_numeric(df["eventDate"].str[:4], errors="coerce")

    df["source"] = "user_upload"

    return {
        "success": True,
        "errors": coord_errors + presence_errors + date_errors,
        "imported": len(df),
        "data": _to_records(df),
    }


def parse_environment_upload(file_bytes: bytes, filename: str, mapping: dict, variables: list[dict]) -> dict:
    """
    mapping: {"latitude": "<col>", "longitude": "<col>"}
    variables: [{"column": "<col in the spreadsheet>", "name": "<name used by the models>"}, ...]
    """
    lat_col = mapping.get("latitude")
    lon_col = mapping.get("longitude")
    var_columns = [v.get("column") for v in variables if v.get("column")]
    wanted_cols = list(dict.fromkeys(c for c in [lat_col, lon_col, *var_columns] if c)) or None

    try:
        df = _read_spreadsheet(file_bytes, filename, usecols=wanted_cols)
    except Exception as e:
        return {"success": False, "errors": [f"Não foi possível ler o arquivo: {str(e)}"], "data": []}

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
