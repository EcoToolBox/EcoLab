# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_submodules, copy_metadata

datas = []
binaries = []
hiddenimports = []

# ── Dados estáticos da aplicação ──────────────────────────────────────────────
import os

ROOT = os.path.dirname(SPECPATH)

datas += [
    (os.path.join(ROOT, 'ecoLab', 'backend'), 'ecoLab/backend'),
    (os.path.join(ROOT, 'ecoLab', 'frontend', 'build'), 'ecoLab/frontend/build'),
    (os.path.join(ROOT, 'ecoLab', 'maps'), 'ecoLab/maps'),
]

# ── Metadados (importlib.metadata.version) ────────────────────────────────────
datas += copy_metadata('pyinaturalist')
datas += copy_metadata('pyogrio')
datas += copy_metadata('geopandas')

# ── fastapi ───────────────────────────────────────────────────────────────────
tmp = collect_all('fastapi')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── starlette ─────────────────────────────────────────────────────────────────
tmp = collect_all('starlette')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── numpy ─────────────────────────────────────────────────────────────────────
tmp = collect_all('numpy')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('numpy')

# ── scipy ─────────────────────────────────────────────────────────────────────
tmp = collect_all('scipy')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('scipy')

# ── scikit-learn ──────────────────────────────────────────────────────────────
tmp = collect_all('sklearn')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('scikit-learn')

# ── pandas ────────────────────────────────────────────────────────────────────
tmp = collect_all('pandas')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('pandas')

# ── shapely ───────────────────────────────────────────────────────────────────
tmp = collect_all('shapely')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('shapely')

# ── pyproj ────────────────────────────────────────────────────────────────────
tmp = collect_all('pyproj')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('pyproj')

# ── networkx ──────────────────────────────────────────────────────────────────
tmp = collect_all('networkx')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('networkx')

# ── pygam ─────────────────────────────────────────────────────────────────────
tmp = collect_all('pygam')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('pygam')

# ── matplotlib ────────────────────────────────────────────────────────────────
tmp = collect_all('matplotlib')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('matplotlib')

# ── duckdb ────────────────────────────────────────────────────────────────────
tmp = collect_all('duckdb')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('duckdb')

# ── earthengine-api ───────────────────────────────────────────────────────────
tmp = collect_all('ee')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pygbif ────────────────────────────────────────────────────────────────────
tmp = collect_all('pygbif')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('pygbif')

# ── pyinaturalist ─────────────────────────────────────────────────────────────
tmp = collect_all('pyinaturalist')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pyogrio + GDAL ────────────────────────────────────────────────────────────
tmp = collect_all('pyogrio')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── geopandas ─────────────────────────────────────────────────────────────────
tmp = collect_all('geopandas')
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

# ── ecoLab package ────────────────────────────────────────────────────────────
tmp = collect_all('ecoLab')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── requests_cache ────────────────────────────────────────────────────────────
tmp = collect_all('requests_cache')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pycountry ─────────────────────────────────────────────────────────────────
tmp = collect_all('pycountry')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
datas += copy_metadata('pycountry')

# ── uvicorn ───────────────────────────────────────────────────────────────────
tmp = collect_all('uvicorn')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── diskcache ─────────────────────────────────────────────────────────────────
tmp = collect_all('diskcache')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pooch ─────────────────────────────────────────────────────────────────────
tmp = collect_all('pooch')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── requests_ratelimiter ──────────────────────────────────────────────────────
tmp = collect_all('requests_ratelimiter')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── pyrate_limiter ────────────────────────────────────────────────────────────
tmp = collect_all('pyrate_limiter')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── geodatasets ───────────────────────────────────────────────────────────────
tmp = collect_all('geodatasets')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── python_dotenv ─────────────────────────────────────────────────────────────
tmp = collect_all('dotenv')
datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]

# ── fiona (fallback do geopandas) ─────────────────────────────────────────────
try:
    tmp = collect_all('fiona')
    datas += tmp[0]; binaries += tmp[1]; hiddenimports += tmp[2]
    datas += copy_metadata('fiona')
except Exception:
    pass

# ── hidden imports ────────────────────────────────────────────────────────────
hiddenimports += [
    'fastapi.middleware.cors',
    'fastapi.middleware',
    'starlette.middleware.cors',
    *collect_submodules('fastapi'),
    *collect_submodules('starlette'),
    *collect_submodules('pygam'),
    'ecoLab',
    *collect_submodules('numpy'),
    *collect_submodules('scipy'),
    *collect_submodules('sklearn'),
    *collect_submodules('pandas'),
    *collect_submodules('shapely'),
    *collect_submodules('pyproj'),
    *collect_submodules('networkx'),
    *collect_submodules('pygam'),
    *collect_submodules('matplotlib'),
    *collect_submodules('duckdb'),
    *collect_submodules('ee'),
    *collect_submodules('pygbif'),
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
    *collect_submodules('pycountry'),
    *collect_submodules('uvicorn'),
    *collect_submodules('diskcache'),
    *collect_submodules('pooch'),
    *collect_submodules('requests_ratelimiter'),
    *collect_submodules('pyrate_limiter'),
    *collect_submodules('geodatasets'),
    *collect_submodules('dotenv'),
    'pyogrio._env',
    'fiona',
    'fiona.ogrext',
]

a = Analysis(
    [os.path.join(os.path.dirname(SPECPATH), 'scripts', 'run_exe.py')],
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
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
