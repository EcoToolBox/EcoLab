"""Inicia o EcoLab em modo de desenvolvimento em Windows, macOS e Linux."""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def start(command: list[str], cwd: Path) -> subprocess.Popen:
    return subprocess.Popen(command, cwd=cwd, env=os.environ.copy())


def main() -> None:
    npm = "npm.cmd" if os.name == "nt" else "npm"
    backend = start([sys.executable, "-m", "uvicorn", "backend.main:app", "--reload"], ROOT / "ecoLab")
    frontend = start([npm, "start"], ROOT / "ecoLab" / "frontend")

    def open_browser() -> None:
        if os.environ.get("ECOLAB_OPEN_BROWSER", "1") != "0":
            webbrowser.open("http://localhost:3000")

    threading.Timer(4, open_browser).start()
    try:
        backend.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for process in (frontend, backend):
            process.terminate()
        for process in (frontend, backend):
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    main()
