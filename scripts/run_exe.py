import subprocess

import matplotlib
matplotlib.use("Agg")

import sys
import os
import threading
import webbrowser
import socket
import sys
import os

from pathlib import Path
from diskcache import Cache

def _get_persistent_cache_dir(name: str) -> Path:
    base = Path(os.path.dirname(sys.executable)) if getattr(sys, "frozen", False) else Path.cwd()
    path = base / name
    path.mkdir(exist_ok=True)
    return path

import diskcache
_original_cache = diskcache.Cache

def _patched_cache(directory, *args, **kwargs):
    dir_path = Path(directory)
    if dir_path.name in (".worldclim_cache", ".sentinel_cache", ".all_cache", ".gbif_cache", ".inaturalist_cache", ".specieslink_cache"):
        directory = _get_persistent_cache_dir(dir_path.name)
    return _original_cache(directory, *args, **kwargs)

diskcache.Cache = _patched_cache

def get_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]
def base_path(*parts):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, *parts)

sys.path.insert(0, base_path())

import uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from ecoLab.backend.main import app

frontend_path = base_path("ecoLab", "frontend", "build")

app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(frontend_path, "index.html"))

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    if not full_path.startswith("api/"):
        return FileResponse(os.path.join(frontend_path, "index.html"))


def open_browser():
    webbrowser.open("http://localhost:8000")

def kill_port(port: int):
    subprocess.run(
        f'for /f "tokens=5" %a in (\'netstat -ano ^| findstr :{port}\') do taskkill /F /PID %a',
        shell=True, capture_output=True
    )
    
if __name__ == "__main__":
    try:
        kill_port(8000)
        port = 8000
        threading.Timer(1.0, open_browser).start()
        uvicorn.run(app, host="127.0.0.1", port=port, log_level="debug")
    except Exception as e:
        print(f"\nERRO: {e}")
        import traceback
        traceback.print_exc()
    finally:
        input("\nPressione Enter para fechar...")