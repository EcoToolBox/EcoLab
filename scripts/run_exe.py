import matplotlib
matplotlib.use("Agg")

import sys
import os
import threading
import webbrowser

def base_path(*parts):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, *parts)

sys.path.insert(0, base_path())

import uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from ecoLab.backend.main import app

frontend_path = base_path("ecoLab", "frontend", "build")

app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

def open_browser():
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    threading.Timer(1.5, open_browser).start()
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")