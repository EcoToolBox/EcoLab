# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules, copy_metadata

datas = []
binaries = []
hiddenimports = []

# ── Dados estáticos da aplicação ──────────────────────────────────────────────
datas += [
    ('ecoLab/backend', 'ecoLab/backend'),
    ('ecoLab/frontend/build', 'ecoLab/frontend/build'),
    ('ecoLab/maps', 'ecoLab/maps'),
]

# ── Metadados (importlib.metadata.version) ────────────────────────────────────
datas += copy_metadata('pyinaturalist')
datas += copy_metadata('pyogrio')
datas += copy_metadata('geopandas')

tmp = collect_all('fastapi')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

tmp = collect_all('starlette')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pyinaturalist ─────────────────────────────────────────────────────────────
tmp = collect_all('pyinaturalist')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pyogrio + GDAL ────────────────────────────────────────────────────────────
tmp = collect_all('pyogrio')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── ecoobs ────────────────────────────────────────────────────────────────────
tmp = collect_all('ecoobs')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('ecoobs')

# ── ecoInteract ───────────────────────────────────────────────────────────────
tmp = collect_all('ecoInteract')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('ecoInteract')

# ── ecoenv ────────────────────────────────────────────────────────────────────
tmp = collect_all('ecoenv')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('ecoenv')

# ── geopandas ─────────────────────────────────────────────────────────────────
tmp = collect_all('geopandas')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── fiona (fallback do geopandas) ─────────────────────────────────────────────
try:
    tmp = collect_all('fiona')
    datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
    datas += copy_metadata('fiona')
except Exception:
    pass

# ── ecoLab package ────────────────────────────────────────────────────────────
tmp = collect_all('ecoLab')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── hidden imports ────────────────────────────────────────────────────────────
hiddenimports += [
    'fastapi.middleware.cors',
    'fastapi.middleware',
    'starlette.middleware.cors',
    *collect_submodules('fastapi'),
    *collect_submodules('starlette'),
    'ecoLab',
    'ecoLab.backend',
    'ecoLab.backend.main',
    'ecoLab.backend.services',
    *collect_submodules('ecoLab'),
    *collect_submodules('pyinaturalist'),
    *collect_submodules('pyogrio'),
    *collect_submodules('ecoobs'),
    *collect_submodules('ecoInteract'),
    *collect_submodules('ecoenv'),
    *collect_submodules('geopandas'),
    'pyogrio._env',
    'fiona',
    'fiona.ogrext',
]


a = Analysis(
    ['scripts/run_exe.py'],
    pathex=['.'],
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
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX desativado no Linux por problemas de compatibilidade
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
