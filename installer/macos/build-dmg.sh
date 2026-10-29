#!/usr/bin/env bash
# Gera o ícone .icns (antes do PyInstaller) ou o .dmg (depois).
#   installer/macos/build-dmg.sh icon
#   installer/macos/build-dmg.sh dmg <arquivo-saida.dmg>
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

make_icon() {
  local set
  set="$(mktemp -d)/EcoLab.iconset"
  mkdir -p "$set"
  for size in 16 32 128 256 512; do
    sips -z $size $size "$HERE/icon-1024.png" --out "$set/icon_${size}x${size}.png" >/dev/null
    sips -z $((size*2)) $((size*2)) "$HERE/icon-1024.png" --out "$set/icon_${size}x${size}@2x.png" >/dev/null
  done
  iconutil -c icns "$set" -o "$ROOT/build/EcoLab.icns"
  echo "Ícone gerado: build/EcoLab.icns"
}

make_dmg() {
  local out="${1:?informe o nome do .dmg}"
  local app="$ROOT/dist/EcoLab.app"
  test -d "$app" || { echo "dist/EcoLab.app não encontrado."; exit 1; }

  # Assinatura ad-hoc: sem ela o Apple Silicon diz que o app "está danificado".
  codesign --force --deep --sign - "$app"

  local stage
  stage="$(mktemp -d)"
  cp -R "$app" "$stage/"
  cp "$HERE/LEIA-ME.txt" "$stage/Como abrir o EcoLab.txt"

  rm -f "$out"
  # create-dmg devolve 2 quando não consegue embelezar a janela (CI sem GUI); o dmg sai ok.
  create-dmg \
    --volname "EcoLab" \
    --volicon "$ROOT/build/EcoLab.icns" \
    --window-pos 200 120 --window-size 640 420 --icon-size 110 \
    --icon "EcoLab.app" 160 180 \
    --app-drop-link 480 180 \
    --icon "Como abrir o EcoLab.txt" 320 330 \
    --hide-extension "EcoLab.app" \
    --no-internet-enable \
    "$out" "$stage" || [ $? -eq 2 ]
  test -f "$out"
  echo "DMG gerado: $out"
}

case "${1:-}" in
  icon) make_icon ;;
  dmg)  make_dmg "${2:-}" ;;
  *) echo "uso: $0 icon | dmg <saida.dmg>"; exit 1 ;;
esac
