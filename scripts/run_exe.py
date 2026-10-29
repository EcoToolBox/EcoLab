"""Ponto de entrada do EcoLab empacotado (PyInstaller).

O que este launcher faz, em ordem:
  1. Usa uma pasta de dados do usuário (não precisa de admin, nem de UAC).
  2. Se o EcoLab já estiver aberto, só abre o navegador nele e sai.
  3. Escolhe uma porta livre (8000 por padrão).
  4. Sobe o servidor e abre o navegador quando ele estiver pronto.
  5. Windows/macOS: ícone na bandeja / barra de menus (Abrir, Pasta, Sair).
     Linux ou sem bandeja disponível: roda no terminal, como antes.

Variáveis de ambiente úteis:
  ECOLAB_PORT=8000          força uma porta
  ECOLAB_OPEN_BROWSER=0     não abre o navegador (usado no CI)
  ECOLAB_LOG_LEVEL=debug    mais logs para depuração
  ECOLAB_DATA_DIR=...       pasta de dados alternativa
  ECOLAB_TRAY=0|1           desliga/força o ícone na bandeja
"""

from __future__ import annotations

import json
import os
import platform
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

from platformdirs import user_cache_dir, user_data_dir

FROZEN = getattr(sys, "frozen", False)
APP_NAME, APP_AUTHOR = "EcoLab", "UTFPR"
DEFAULT_PORT = 8000


# ── Pastas ────────────────────────────────────────────────────────────────────
def base_path(*parts: str) -> str:
    """Arquivos embutidos no executável (frontend, backend...)."""
    base = getattr(sys, "_MEIPASS", str(Path(__file__).resolve().parents[1]))
    return os.path.join(base, *parts)


def data_dir() -> Path:
    """Onde o EcoLab grava mapas/resultados. Sempre gravável pelo usuário."""
    custom = os.environ.get("ECOLAB_DATA_DIR")
    if custom:
        path = Path(custom)
    elif FROZEN:
        path = Path(user_data_dir(APP_NAME, APP_AUTHOR))
    else:
        path = Path.cwd()
    path.mkdir(parents=True, exist_ok=True)
    return path


DATA_DIR = data_dir()
# main.py grava "maps/" relativo ao diretório atual; mudando pra cá o app
# funciona instalado em Program Files / /opt / /Applications sem admin.
os.chdir(DATA_DIR)

# Em modo janela (macOS .app) stdout/stderr podem ser None; manda pro log.
if sys.stdout is None or sys.stderr is None:
    _log = open(DATA_DIR / "ecolab.log", "w", encoding="utf-8", buffering=1)  # só a última execução
    sys.stdout = sys.stdout or _log
    sys.stderr = sys.stderr or _log

# Console do Windows redirecionado (ex.: CI) usa cp1252; nunca quebrar por acento.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="replace")
    except Exception:
        pass


# ── Cache persistente (diskcache das libs eco*) ──────────────────────────────
import diskcache  # noqa: E402

_original_cache = diskcache.Cache
_CACHE_NAMES = {
    ".worldclim_cache", ".sentinel_cache", ".all_cache",
    ".gbif_cache", ".inaturalist_cache", ".specieslink_cache",
}


def _persistent_cache_dir(name: str) -> Path:
    base = Path(user_cache_dir(APP_NAME, APP_AUTHOR)) if FROZEN else Path.cwd()
    path = base / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def _patched_cache(directory=None, *args, **kwargs):
    if directory is not None and Path(directory).name in _CACHE_NAMES:
        directory = _persistent_cache_dir(Path(directory).name)
    return _original_cache(directory, *args, **kwargs)


diskcache.Cache = _patched_cache


# ── Porta / instância já aberta ───────────────────────────────────────────────
def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def ecolab_running_on(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/config", timeout=1.5) as r:
            return r.status == 200 and "port" in json.loads(r.read().decode() or "{}")
    except Exception:
        return False


def choose_port() -> tuple[int, bool]:
    """Retorna (porta, ja_esta_rodando)."""
    forced = os.environ.get("ECOLAB_PORT")
    port = int(forced) if forced else DEFAULT_PORT
    if port_is_free(port):
        return port, False
    if ecolab_running_on(port):
        return port, True
    if forced:
        raise SystemExit(f"A porta {port} (ECOLAB_PORT) está ocupada por outro programa.")
    return get_free_port(), False


def wait_and_open_browser(url: str, port: int) -> None:
    if os.environ.get("ECOLAB_OPEN_BROWSER", "1") == "0":
        return
    for _ in range(120):  # até ~60 s no primeiro start (antivírus, disco lento...)
        if ecolab_running_on(port):
            break
        time.sleep(0.5)
    webbrowser.open(url)


def banner(url: str) -> None:
    line = "=" * 58
    print(
        f"\n  {line}\n"
        f"   EcoLab está rodando\n\n"
        f"   Abra no navegador:  {url}\n"
        f"   Seus dados ficam em: {DATA_DIR}\n\n"
        f"   Para encerrar, feche esta janela (ou Ctrl+C).\n"
        f"  {line}\n",
        flush=True,
    )


def show_error(message: str) -> None:
    """Mostra o erro numa janela nativa (no modo bandeja não existe console)."""
    print(message, file=sys.stderr, flush=True)
    system = platform.system()
    try:
        if system == "Windows":
            import ctypes

            ctypes.windll.user32.MessageBoxW(0, message, "EcoLab", 0x10)  # MB_ICONERROR
        elif system == "Darwin":
            import subprocess

            safe = message.replace("\\", "\\\\").replace('"', '\\"')
            subprocess.run(
                ["osascript", "-e", f'display alert "EcoLab" message "{safe}" as critical'],
                check=False, timeout=300,
            )
    except Exception:
        pass


def pause_on_error() -> None:
    if FROZEN and platform.system() == "Windows" and sys.stdin and sys.stdin.isatty():
        try:
            input("\nPressione Enter para fechar...")
        except EOFError:
            pass


def open_folder(path: Path) -> None:
    import subprocess

    system = platform.system()
    if system == "Windows":
        os.startfile(path)  # type: ignore[attr-defined]
    elif system == "Darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


# ── Bandeja do sistema ────────────────────────────────────────────────────────
def tray_wanted() -> bool:
    env = os.environ.get("ECOLAB_TRAY")
    if env is not None:
        return env == "1"
    # Linux: muitos desktops (GNOME) escondem ícones de bandeja; fica no terminal.
    return platform.system() in ("Windows", "Darwin")


def tray_image():
    from PIL import Image, ImageDraw

    for candidate in (
        base_path("assets", "ecolab.png"),
        str(Path(__file__).resolve().parents[1] / "installer" / "linux" / "ecolab.png"),
    ):
        if os.path.isfile(candidate):
            return Image.open(candidate)
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    ImageDraw.Draw(img).ellipse((4, 4, 60, 60), fill=(52, 87, 2, 255))
    return img


def run_with_tray(server, url: str, port: int) -> bool:
    """Roda o servidor em segundo plano e o ícone na thread principal.

    Retorna False se a bandeja não pôde ser criada (aí o chamador segue sem ela).
    """
    try:
        import pystray
    except Exception as exc:  # dependência ausente no build
        print(f"Bandeja indisponível ({exc}); seguindo sem ícone.", flush=True)
        return False

    server_thread = threading.Thread(target=server.run, name="uvicorn", daemon=True)

    def quit_app(icon, _item=None):
        server.should_exit = True
        icon.visible = False
        icon.stop()

    def watch_startup(icon):
        """Abre o navegador quando o servidor estiver pronto, ou avisa se ele morrer."""
        for _ in range(240):
            if server.started:
                if os.environ.get("ECOLAB_OPEN_BROWSER", "1") != "0":
                    webbrowser.open(url)
                if platform.system() == "Windows":
                    try:
                        icon.notify("O EcoLab está aberto no navegador. Para sair, use este ícone.", "EcoLab")
                    except Exception:
                        pass
                return
            if not server_thread.is_alive():
                break
            time.sleep(0.5)
        show_error(
            "O EcoLab não conseguiu iniciar.\n\n"
            f"Veja os detalhes em:\n{DATA_DIR / 'ecolab.log'}"
        )
        quit_app(icon)

    def setup(icon):
        icon.visible = True
        watch_startup(icon)

    menu = pystray.Menu(
        pystray.MenuItem("Abrir EcoLab", lambda: webbrowser.open(url), default=True),
        pystray.MenuItem("Pasta de resultados", lambda: open_folder(DATA_DIR)),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(f"Rodando na porta {port}", None, enabled=False),
        pystray.MenuItem("Sair", quit_app),
    )
    try:
        icon = pystray.Icon("EcoLab", tray_image(), f"EcoLab ({url})", menu)
    except Exception as exc:
        print(f"Bandeja indisponível ({exc}); seguindo sem ícone.", flush=True)
        return False

    server_thread.start()
    try:
        icon.run(setup=setup)  # bloqueia até "Sair"
    except Exception as exc:
        # não deu pra desenhar o ícone (ex.: sessão sem área de trabalho): mantém o servidor
        print(f"Falha na bandeja ({exc}); servidor continua rodando.", flush=True)
        server_thread.join()
        return True
    server.should_exit = True
    server_thread.join(timeout=10)
    return True


def main() -> None:
    port, already_running = choose_port()
    url = f"http://localhost:{port}"

    if already_running:
        print(f"O EcoLab já está aberto em {url}. Abrindo o navegador...")
        if os.environ.get("ECOLAB_OPEN_BROWSER", "1") != "0":
            webbrowser.open(url)
        return

    os.environ["APP_PORT"] = str(port)  # lido por /api/config no frontend

    sys.path.insert(0, base_path())
    import uvicorn
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    from ecoLab.backend.main import app

    frontend_path = base_path("ecoLab", "frontend", "build")
    index_html = os.path.join(frontend_path, "index.html")
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(index_html)

    @app.get("/{full_path:path}")
    def catch_all(full_path: str):
        if not full_path.startswith("api/"):
            candidate = os.path.realpath(os.path.join(frontend_path, full_path))
            inside = candidate.startswith(os.path.realpath(frontend_path) + os.sep)
            if inside and os.path.isfile(candidate):  # favicon, manifest.json, logos...
                return FileResponse(candidate)
            return FileResponse(index_html)

    server = uvicorn.Server(uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level=os.environ.get("ECOLAB_LOG_LEVEL", "info"),
    ))

    banner(url)
    if tray_wanted() and run_with_tray(server, url, port):
        return
    threading.Thread(target=wait_and_open_browser, args=(url, port), daemon=True).start()
    server.run()


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        if isinstance(exc.code, str):  # mensagem amigável (ex.: porta ocupada)
            show_error(exc.code)
            sys.exit(1)
        raise
    except Exception as exc:  # mostra o erro em vez de fechar na cara
        import traceback

        print(f"\nERRO ao iniciar o EcoLab: {exc}\n")
        traceback.print_exc()
        print(f"\nSe precisar de ajuda, envie o texto acima. Dados em: {DATA_DIR}")
        if tray_wanted():
            show_error(f"Erro ao iniciar o EcoLab:\n{exc}\n\nDetalhes em:\n{DATA_DIR / 'ecolab.log'}")
        pause_on_error()
        sys.exit(1)
