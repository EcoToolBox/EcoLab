import matplotlib
matplotlib.use("Agg")

import sys
import os
import threading
import webbrowser
import time
import socket

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

if __name__ == "__main__":
    threading.Timer(1.5, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_config=None)