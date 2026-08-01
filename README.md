<div align="center">
  <img src="ecoLab/frontend/public/favicon.ico" width="88" alt="EcoLab logo" />
  <h1>EcoLab</h1>
  <p><strong>Modelagem de distribuição potencial de espécies, sem complicação.</strong></p>
  <p>Dados de ocorrência, ambiente e interações biológicas em um único fluxo de trabalho.</p>

  [![Build](https://github.com/EcoToolBox/EcoLab/actions/workflows/build.yml/badge.svg)](https://github.com/EcoToolBox/EcoLab/actions/workflows/build.yml)
  ![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
  ![Platforms](https://img.shields.io/badge/Windows%20%7C%20Linux%20%7C%20macOS-available-2E7D32)
  [![License](https://img.shields.io/badge/license-MIT-5E9E4A)](LICENSE)
</div>

---

## Comece em poucos minutos

1. Baixe o instalador apropriado na [página de releases](../../releases/latest).
2. Instale ou mova o EcoLab para a pasta de aplicativos do seu sistema.
3. Abra o programa e siga o fluxo: espécies → ocorrências → ambiente → modelos → resultados.

| Sistema | Arquivo para baixar | Instalação |
|---|---|---|
| Windows | `EcoLab_Setup.exe` | Execute o instalador e siga o assistente. |
| Linux (Debian/Ubuntu) | `EcoLab-Linux.deb` | Abra o arquivo ou use `sudo apt install ./EcoLab-Linux.deb`. |
| macOS Intel | `EcoLab-macOS-intel.dmg` | Abra o DMG e arraste o EcoLab para **Aplicativos**. |
| macOS Apple Silicon | `EcoLab-macOS-apple-silicon.dmg` | Abra o DMG e arraste o EcoLab para **Aplicativos**. |

> Na primeira abertura, o macOS pode pedir confirmação do Gatekeeper. Clique com o botão direito no EcoLab, escolha **Abrir** e confirme. Não é necessário desativar a proteção do sistema.

## Antes da primeira análise

### Google Earth Engine

As variáveis ambientais automáticas exigem uma conta no [Google Earth Engine](https://earthengine.google.com/) e um projeto do Google Cloud.

1. Crie ou selecione um projeto em [console.cloud.google.com](https://console.cloud.google.com).
2. Copie o **ID do projeto**.
3. No EcoLab, em **Ambiente**, informe o ID e conclua a autenticação no navegador.

Você também pode enviar sua própria grade ambiental em CSV, sem usar o Earth Engine.

### Formato de planilhas

Para evitar problemas de importação, prefira CSV separado por `;` e decimais com ponto:

```csv
latitude;longitude;temperatura
-19.963668;-44.199772;23.4
```

O EcoLab também reconhece tabulação e vírgula como separador, bem como ponto ou vírgula decimal nas coordenadas.

## O que o EcoLab faz

- Busca ocorrências em GBIF, iNaturalist e SpeciesLink.
- Aceita planilhas próprias de ocorrências e de variáveis ambientais.
- Consulta interações biológicas no GloBI.
- Obtém NDVI, NDWI, temperatura e precipitação via Google Earth Engine.
- Executa MaxEnt, GAM, Random Forest, SVM e BRT.
- Gera mapas de distribuição potencial e exporta resultados em CSV e PNG.

## Fluxo de trabalho

```text
Espécies → Ocorrências → Interações → Ambiente → Modelos → Resultados
```

Na seleção de espécies, você pode pesquisar uma por vez, navegar pela árvore taxonômica ou colar uma lista de nomes científicos.

## Desenvolvimento

### Pré-requisitos

- Python 3.11
- Node.js 20
- Git

No Linux e macOS, as bibliotecas geoespaciais do sistema podem ser necessárias para construir o aplicativo.

### Inicialização local

```bash
git clone https://github.com/EcoToolBox/EcoLab.git
cd EcoLab
python -m venv .venv
```

Ative o ambiente virtual:

```bash
# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate
```

Instale as dependências e inicie os dois serviços:

```bash
pip install -r requirements.txt
cd ecoLab/frontend && npm ci && cd ../..
python scripts/run.py
```

O navegador abre em `http://localhost:3000`. Para não abrir automaticamente, defina `ECOLAB_OPEN_BROWSER=0` antes de iniciar.

## Builds e qualidade

Cada alteração em `main` e cada pull request executam o GitHub Actions, que:

1. constrói o frontend com dependências travadas (`npm ci`);
2. gera instaladores para Windows, Linux e macOS (Intel e Apple Silicon);
3. instala e inicia os pacotes Linux e macOS em ambientes limpos;
4. só publica a release quando todos os testes de inicialização passam.

## Sobre

O EcoLab é desenvolvido no PPGCA — UTFPR como parte de uma dissertação de mestrado, com foco em tornar análises ecológicas mais acessíveis e reprodutíveis.

## Licença

Distribuído sob a licença [MIT](LICENSE).
