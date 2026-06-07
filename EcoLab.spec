# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules, copy_metadata

datas = []
binaries = []
hiddenimports = []

# ── Dados estáticos da aplicação ──────────────────────────────────────────────
datas += [
    ('ecoLab/frontend/build', 'ecoLab/frontend/build'),
    ('ecoLab/maps', 'ecoLab/maps'),
]

# ── Metadados (importlib.metadata.version) ────────────────────────────────────
datas += copy_metadata('pyinaturalist')
datas += copy_metadata('pyogrio')
datas += copy_metadata('geopandas')

# ── pyinaturalist ─────────────────────────────────────────────────────────────
tmp = collect_all('pyinaturalist')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pyogrio + DLLs do GDAL ───────────────────────────────────────────────────
tmp = collect_all('pyogrio')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── geopandas ─────────────────────────────────────────────────────────────────
tmp = collect_all('geopandas')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── requests_cache ─────────────────────────────────────────────────────────────────
tmp = collect_all('requests_cache')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── fiona (fallback do geopandas) ─────────────────────────────────────────────
try:
    tmp = collect_all('fiona')
    datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
    datas += copy_metadata('fiona')
except Exception:
    pass  # fiona não instalado, tudo bem

# ── hidden imports adicionais ─────────────────────────────────────────────────
hiddenimports += [
    'ecoLab.backend.main',
    'ecoLab.backend.services',
    *collect_submodules('pyinaturalist'),
    *collect_submodules('pyogrio'),
    *collect_submodules('geopandas'),
    'pyogrio._env',
    'fiona',
    'fiona.ogrext',
]

a = Analysis(
    ['scripts\\run_exe.py'],
    pathex=['D:\\UTFPR\\Mestrado\\Projeto\\EcoLab'],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=True,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [('v', None, 'OPTION')],
    name='EcoLab',
    debug=True,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    manifest='EcoLab.manifest',
    entitlements_file=None,
)