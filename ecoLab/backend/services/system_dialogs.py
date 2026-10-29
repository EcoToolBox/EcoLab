"""
Janela nativa de "Selecionar pasta" do sistema operacional.

O navegador não expõe o caminho de uma pasta escolhida pelo usuário, mas o
backend do EcoLab roda na máquina do usuário, então ele mesmo abre a janela:
  - Windows: diálogo do Explorer via PowerShell (System.Windows.Forms);
  - macOS:   "choose folder" via osascript;
  - Linux:   zenity, com tkinter como alternativa.
Usar processos do sistema (e não tkinter direto) evita problemas de thread e
de empacotamento com o PyInstaller.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys

_PS_SCRIPT = r"""
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form -Property @{{TopMost = $true; ShowInTaskbar = $false}}
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '{title}'
$dialog.ShowNewFolderButton = $false
{initial}
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {{ [Console]::Out.Write($dialog.SelectedPath) }}
$owner.Dispose()
"""


def _run(cmd: list[str]) -> str | None:
    kwargs = {"capture_output": True, "text": True, "encoding": "utf-8"}
    if sys.platform == "win32":
        kwargs["creationflags"] = 0x08000000  # CREATE_NO_WINDOW: não abre console preto
    result = subprocess.run(cmd, **kwargs)
    path = (result.stdout or "").strip()
    return path or None


def pick_folder(initial: str | None = None, title: str = "Selecione a pasta com os rasters (.tif)") -> str | None:
    """Abre a janela de seleção de pasta e devolve o caminho, ou None se cancelar."""
    initial = initial if initial and os.path.isdir(initial) else None

    if sys.platform == "win32":
        safe_title = title.replace("'", "''")
        init = f"$dialog.SelectedPath = '{initial.replace(chr(39), chr(39) * 2)}'" if initial else ""
        script = _PS_SCRIPT.format(title=safe_title, initial=init)
        return _run(["powershell", "-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script])

    if sys.platform == "darwin":
        prompt = title.replace('"', '\\"')
        default = f' default location (POSIX file "{initial}")' if initial else ""
        return _run(["osascript", "-e", f'POSIX path of (choose folder with prompt "{prompt}"{default})'])

    if shutil.which("zenity"):
        cmd = ["zenity", "--file-selection", "--directory", f"--title={title}"]
        if initial:
            cmd.append(f"--filename={initial.rstrip('/')}/")
        return _run(cmd)

    try:  # último recurso
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askdirectory(title=title, initialdir=initial or os.path.expanduser("~"))
        root.destroy()
        return path or None
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"Não foi possível abrir a janela de seleção de pasta: {exc}") from exc
