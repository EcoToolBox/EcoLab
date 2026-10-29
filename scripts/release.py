"""Publica uma nova versão do EcoLab com um comando só.

    python scripts/release.py 0.2.0          # versão exata
    python scripts/release.py patch          # 0.1.1 -> 0.1.2
    python scripts/release.py minor          # 0.1.1 -> 0.2.0
    python scripts/release.py major          # 0.1.1 -> 1.0.0
    python scripts/release.py minor --dry-run

O que acontece:
  1. confere se você está na main, sem nada pendente e atualizada com o GitHub;
  2. grava a versão em VERSION e no package.json do frontend;
  3. cria o commit "release: vX.Y.Z" e a tag vX.Y.Z;
  4. dá push. O GitHub Actions compila, testa e publica os instaladores.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "VERSION"
PACKAGE_JSON = ROOT / "ecoLab" / "frontend" / "package.json"
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def git(*args: str, capture: bool = True) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, text=True,
                            capture_output=capture, check=False)
    if result.returncode != 0:
        msg = (result.stderr or result.stdout or "").strip() if capture else ""
        sys.exit(f"✖ git {' '.join(args)} falhou\n{msg}")
    return (result.stdout or "").strip() if capture else ""


def bump(current: str, part: str) -> str:
    major, minor, patch = map(int, current.split("."))
    return {
        "major": f"{major + 1}.0.0",
        "minor": f"{major}.{minor + 1}.0",
        "patch": f"{major}.{minor}.{patch + 1}",
    }[part]


def main() -> None:
    parser = argparse.ArgumentParser(description="Publica uma nova versão do EcoLab.")
    parser.add_argument("version", help="X.Y.Z ou patch | minor | major")
    parser.add_argument("--dry-run", action="store_true", help="só mostra o que faria")
    parser.add_argument("-y", "--yes", action="store_true", help="não pede confirmação")
    args = parser.parse_args()

    current = VERSION_FILE.read_text(encoding="utf-8").strip()
    new = bump(current, args.version) if args.version in ("major", "minor", "patch") else args.version.lstrip("v")
    if not SEMVER.match(new):
        sys.exit(f"✖ Versão inválida: {new!r}. Use o formato 1.2.3")
    tag = f"v{new}"

    # ── checagens ──
    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    if branch != "main":
        sys.exit(f"✖ Você está na branch '{branch}'. Faça o release a partir da main.")
    if git("status", "--porcelain"):
        sys.exit("✖ Há alterações não commitadas. Faça commit (ou stash) antes do release.")
    git("fetch", "--tags", "--quiet", "origin")
    if git("rev-list", "--count", "HEAD..origin/main") != "0":
        sys.exit("✖ Sua main está atrás do GitHub. Rode 'git pull' antes.")
    if git("tag", "--list", tag):
        sys.exit(f"✖ A tag {tag} já existe.")

    print(f"\n  EcoLab  {current}  →  {new}\n")
    print("  • VERSION e package.json serão atualizados")
    print(f"  • commit 'release: {tag}' + tag {tag}")
    print("  • push para o GitHub (dispara o build dos instaladores)\n")
    if args.dry_run:
        print("  (dry-run: nada foi alterado)")
        return
    if not args.yes and input("  Confirmar? [s/N] ").strip().lower() not in ("s", "sim", "y", "yes"):
        print("  Cancelado.")
        return

    VERSION_FILE.write_text(new + "\n", encoding="utf-8")
    pkg = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    pkg["version"] = new
    PACKAGE_JSON.write_text(json.dumps(pkg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    git("add", str(VERSION_FILE), str(PACKAGE_JSON))
    git("commit", "-m", f"release: {tag}")
    git("tag", "-a", tag, "-m", f"EcoLab {new}")
    git("push", "--atomic", "origin", "main", tag, capture=False)

    remote = git("remote", "get-url", "origin").removesuffix(".git")
    remote = re.sub(r"^git@github\.com:", "https://github.com/", remote)
    print(f"\n  ✔ {tag} enviada! Acompanhe o build em:\n    {remote}/actions\n")
    print(f"  Quando terminar (~25 min), os instaladores estarão em:\n    {remote}/releases/tag/{tag}\n")


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except Exception:
            pass
    main()
