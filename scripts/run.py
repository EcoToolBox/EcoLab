"""Inicia o EcoLab em modo de desenvolvimento em Windows, macOS e Linux.

    python scripts/run.py

Usa automaticamente o Python do .venv do projeto (se existir), mesmo que
o venv não esteja ativado, e confere as dependências antes de subir.
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

# Pacotes que o backend importa (alguns só sob demanda, por isso checamos aqui)
REQUIRED = ["fastapi", "uvicorn", "pandas", "geopandas", "sklearn", "tifffile", "PIL", "ecoobs", "ecoenv"]


def project_python() -> str:
    """Python do .venv do projeto; se não houver, o Python atual."""
    for candidate in (ROOT / ".venv" / "Scripts" / "python.exe", ROOT / ".venv" / "bin" / "python"):
        if candidate.is_file():
            return str(candidate)
    return sys.executable


def check_dependencies(python: str) -> None:
    code = (
        "import importlib, sys\n"
        f"missing = []\n"
        f"for m in {REQUIRED!r}:\n"
        "    try: importlib.import_module(m)\n"
        "    except Exception as e: missing.append(f'{m} ({type(e).__name__}: {e})')\n"
        "print('\\n'.join(missing)); sys.exit(1 if missing else 0)\n"
    )
    result = subprocess.run([python, "-c", code], capture_output=True, text=True)
    if result.returncode != 0:
        problems = result.stdout.strip().splitlines()
        print(f"\n✖ Problemas com pacotes no Python {python}:\n")
        for line in problems:
            print(f"   - {line}")
        text = "\n".join(problems)
        call = "& " if os.name == "nt" else ""  # PowerShell precisa do & antes de caminho entre aspas
        if "Controle de Aplicativo" in text or "Application Control" in text:
            print(
                "\n  O Windows (Smart App Control / WDAC) bloqueou uma DLL desse pacote."
                "\n  Reinstalar não resolve. Veja o status com:"
                "\n   Get-ItemProperty HKLM:\\SYSTEM\\CurrentControlSet\\Control\\CI\\Policy"
                " -Name VerifiedAndReputablePolicyState\n"
            )
        elif "ModuleNotFoundError" in text:
            print(f"\n  Instale com:\n   {call}\"{python}\" -m pip install -r requirements.txt\n")
        else:
            print(f"\n  O pacote existe mas não carregou. Tente reinstalar:\n"
                  f"   {call}\"{python}\" -m pip install --force-reinstall <pacote>\n")
        sys.exit(1)


def start(command: list[str], cwd: Path) -> subprocess.Popen:
    return subprocess.Popen(command, cwd=cwd, env=os.environ.copy())


def main() -> None:
    python = project_python()
    print(f"Python do backend: {python}")
    check_dependencies(python)

    npm = "npm.cmd" if os.name == "nt" else "npm"
    backend = start([python, "-m", "uvicorn", "backend.main:app", "--reload"], ROOT / "ecoLab")
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
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except Exception:
            pass
    main()
