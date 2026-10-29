# Como publicar uma versão do EcoLab

## TL;DR

```bash
git checkout main && git pull
python scripts/release.py minor      # ou patch / major / 0.3.0
```

Pronto. Em ~25 min os instaladores aparecem em **Releases** e os links do README já apontam pra eles.

---

## Os dois canais

| Canal | Quando é gerado | Onde fica | Pra quem |
|---|---|---|---|
| **Nightly** 🌙 | todo push na `main` | release `nightly` (pré-release) | você, testes, a Aline testar uma correção |
| **Estável** ✅ | quando você roda `scripts/release.py` | release `vX.Y.Z` (marcada como *Latest*) | usuários finais, link do artigo/dissertação |

PRs só compilam e testam, não publicam nada. Commits que mexem só em `.md` / `docs/` nem disparam o build.

## O que o pipeline faz

```
version ─┐
frontend ┼─► windows ─► instala em silêncio + abre + testa ─┐
         ├─► linux   ─► instala o .deb + abre + testa ──────┼─► publica (nightly ou vX.Y.Z)
         └─► macos   ─► monta o .dmg + abre + testa ────────┘
```

* O **frontend** é compilado uma vez só e reaproveitado pelos 3 sistemas.
* A **versão** vem do arquivo `VERSION` (nightly vira `0.2.0-dev.57`). Não precisa editar versão em mais nenhum lugar: `.iss`, `.deb` e `Info.plist` leem dela.
* Cada instalador é **instalado de verdade e aberto** no CI. Se o app não responder em `/api/config` e servir o `index.html`, o build falha e nada é publicado.
* A release inclui `SHA256SUMS.txt`.

## Nomes fixos dos arquivos

Os nomes não mudam entre versões, então estes links sempre baixam a última versão estável:

* `https://github.com/EcoToolBox/EcoLab/releases/latest/download/EcoLab-Windows-Setup.exe`
* `https://github.com/EcoToolBox/EcoLab/releases/latest/download/EcoLab-Linux-amd64.deb`
* `https://github.com/EcoToolBox/EcoLab/releases/latest/download/EcoLab-macOS-AppleSilicon.dmg`

## Deu ruim?

| Sintoma | O que fazer |
|---|---|
| `A tag vX não bate com o arquivo VERSION` | você criou a tag na mão. Apague (`git push --delete origin vX && git tag -d vX`) e use o `release.py`. |
| Build falhou depois da tag | corrija na `main`, depois `python scripts/release.py patch` (não reaproveite a tag). |
| Quero rodar o build sem commitar | aba **Actions → Build & Release → Run workflow**. |
| Smoke test falhou | abra o passo "Teste — abre o app" e expanda **Log do EcoLab**: é a saída do executável. |

## Rodando o instalador localmente (Windows)

```powershell
cd ecoLab\frontend; npm ci; npm run build; cd ..\..
python -m PyInstaller --noconfirm build\EcoLab.spec
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" EcoLab_Installer.iss
# -> installer_output\EcoLab-Windows-Setup.exe
```

## Onde o app guarda dados

O executável não grava mais na pasta de instalação, por isso não pede admin:

| SO | Mapas / resultados | Cache de downloads |
|---|---|---|
| Windows | `%LOCALAPPDATA%\UTFPR\EcoLab` | `%LOCALAPPDATA%\UTFPR\EcoLab\Cache` |
| Linux | `~/.local/share/EcoLab` | `~/.cache/EcoLab` |
| macOS | `~/Library/Application Support/EcoLab` | `~/Library/Caches/EcoLab` |

Variáveis úteis: `ECOLAB_PORT`, `ECOLAB_OPEN_BROWSER=0`, `ECOLAB_LOG_LEVEL=debug`, `ECOLAB_DATA_DIR`, `ECOLAB_TRAY=0|1`.

## Ícone na bandeja

* **Windows / macOS:** sem janela preta. O app vive num ícone perto do relógio (menu: Abrir EcoLab, Pasta de resultados, Sair). O log da execução fica em `ecolab.log` na pasta de dados, e erros de inicialização aparecem numa janela de aviso.
* **Linux:** continua no terminal, porque o GNOME esconde ícones de bandeja por padrão e o usuário ficaria sem como fechar. Dá pra forçar com `ECOLAB_TRAY=1`.
* Se a bandeja falhar por qualquer motivo, o servidor segue rodando normalmente.
