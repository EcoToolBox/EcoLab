#!/usr/bin/env bash
# Gera EcoLab-Linux-amd64.deb a partir de dist/EcoLab (PyInstaller).
# Uso: installer/linux/build-deb.sh <versão>     ex.: installer/linux/build-deb.sh 0.2.0
set -euo pipefail

VERSION="${1:?informe a versão, ex.: 0.2.0}"
DEB_VERSION="${VERSION//-/\~}"          # 0.2.0-dev.12 -> 0.2.0~dev.12 (ordena antes da 0.2.0)
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PKG="$(mktemp -d)/ecolab"
OUT="${2:-$ROOT/EcoLab-Linux-amd64.deb}"

test -x "$ROOT/dist/EcoLab" || { echo "dist/EcoLab não encontrado. Rode o PyInstaller antes."; exit 1; }

install -Dm755 "$ROOT/dist/EcoLab"           "$PKG/opt/ecolab/EcoLab"
install -Dm644 "$HERE/ecolab.png"            "$PKG/usr/share/icons/hicolor/256x256/apps/ecolab.png"
install -Dm644 "$HERE/ecolab.desktop"        "$PKG/usr/share/applications/ecolab.desktop"
install -Dm644 "$ROOT/LICENSE"               "$PKG/usr/share/doc/ecolab/copyright"
mkdir -p "$PKG/usr/bin"
ln -s /opt/ecolab/EcoLab "$PKG/usr/bin/ecolab"

mkdir -p "$PKG/DEBIAN"
cat > "$PKG/DEBIAN/control" <<EOF
Package: ecolab
Version: ${DEB_VERSION}
Section: science
Priority: optional
Architecture: amd64
Depends: xdg-utils
Installed-Size: $(du -sk "$PKG" | cut -f1)
Maintainer: Ane Simoes <anecarolina.simoes@gmail.com>
Homepage: https://github.com/EcoToolBox/EcoLab
Description: EcoLab - Species Distribution Modeling
 Aplicação para modelagem de distribuição de espécies (SDM):
 coleta de ocorrências (GBIF, iNaturalist, SpeciesLink), variáveis
 ambientais e interações, treino de modelos e mapas de adequabilidade.
EOF

cat > "$PKG/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q /usr/share/applications || true
command -v gtk-update-icon-cache  >/dev/null 2>&1 && gtk-update-icon-cache -q /usr/share/icons/hicolor || true
exit 0
EOF
cp "$PKG/DEBIAN/postinst" "$PKG/DEBIAN/postrm"
chmod 755 "$PKG/DEBIAN/postinst" "$PKG/DEBIAN/postrm"

dpkg-deb --root-owner-group --build "$PKG" "$OUT"
echo "Pacote gerado: $OUT"
