#!/usr/bin/env bash
# Sobe o EcoLab empacotado e confere se API e frontend respondem.
# Uso: scripts/ci/smoke-test.sh <caminho-do-executável>
set -uo pipefail   # sem -e de propósito: curl falhando (exit 7) é esperado enquanto o app sobe

EXE="${1:?caminho do executável}"
PORT="${ECOLAB_PORT:-8000}"
LOG="$(mktemp)"
DATA="$(mktemp -d)"   # pasta de dados isolada; no modo bandeja o log vai para $DATA/ecolab.log
TIMEOUT="${SMOKE_TIMEOUT:-120}"

DATA_FOR_APP="$DATA"
command -v cygpath >/dev/null 2>&1 && DATA_FOR_APP="$(cygpath -w "$DATA")"   # .exe do Windows quer C:\...
export ECOLAB_OPEN_BROWSER=0 ECOLAB_PORT="$PORT" ECOLAB_DATA_DIR="$DATA_FOR_APP"
"$EXE" >"$LOG" 2>&1 &
PID=$!

cleanup() {
  kill "$PID" 2>/dev/null || true
  # no Windows o kill do bash nem sempre derruba o .exe
  command -v taskkill >/dev/null 2>&1 && taskkill //F //T //IM "$(basename "$EXE")" >/dev/null 2>&1 || true
  echo "::group::Log do EcoLab"; cat "$LOG" "$DATA/ecolab.log" 2>/dev/null; echo "::endgroup::"
}
trap cleanup EXIT

echo "Aguardando EcoLab em http://127.0.0.1:$PORT (até ${TIMEOUT}s)..."
for ((i = 0; i < TIMEOUT; i += 2)); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "::error::O EcoLab encerrou sozinho durante a inicialização."
    exit 1
  fi
  if curl -fsS "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1; then
    curl -fsS "http://127.0.0.1:$PORT/" | grep -qi "<div id=\"root\"" \
      || { echo "::error::API respondeu, mas o frontend (index.html) não."; exit 1; }
    echo "✅ EcoLab subiu em ${i}s: API e frontend OK."
    # leitura de GeoTIFF (tifffile + LZW do Pillow) funciona dentro do executável?
    RASTERS="$DATA/rasters"; mkdir -p "$RASTERS"
    FIXTURE="$(dirname "$0")/fixtures/smoke_bio_1.tif"
    if [ ! -f "$FIXTURE" ]; then
      echo "::error::Raster de teste não encontrado: $FIXTURE (está no .gitignore ou não foi commitado?)"
      exit 1
    fi
    cp "$FIXTURE" "$RASTERS/"
    RASTERS_FOR_APP="$RASTERS"
    command -v cygpath >/dev/null 2>&1 && RASTERS_FOR_APP="$(cygpath -w "$RASTERS")"
    body="$(python3 -c 'import json,sys; print(json.dumps({"folder": sys.argv[1]}))' "$RASTERS_FOR_APP" 2>/dev/null \
         || python -c 'import json,sys; print(json.dumps({"folder": sys.argv[1]}))' "$RASTERS_FOR_APP")"
    resp="$(curl -sS -X POST -H 'Content-Type: application/json' -d "$body" "http://127.0.0.1:$PORT/api/rasters/scan")"
    if ! echo "$resp" | grep -q '"smoke_bio_1"'; then
      echo "::error::Leitura de GeoTIFF falhou dentro do executável: $resp"
      exit 1
    fi
    echo "✅ GeoTIFF OK: leu o raster de teste (LZW + predictor 3)."
    exit 0
  fi
  sleep 2
done

echo "::error::EcoLab não respondeu em ${TIMEOUT}s."
exit 1
