<div align="center">
  <img src="ecoLab/frontend/public/favicon.ico" width="80" alt="EcoLab Logo"/>
  <h1>EcoLab</h1>
  <p>Ferramenta desktop para modelagem de distribuição potencial de espécies,<br/>integrando dados de ocorrência, variáveis ambientais e interações bióticas.</p>

  ![License](https://img.shields.io/badge/license-MIT-green)
  ![Python](https://img.shields.io/badge/python-3.11-blue)
  ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)
  ![Build](https://github.com/EcoToolBox/EcoLab/actions/workflows/build.yml/badge.svg)
</div>

---

## Sobre

O EcoLab é uma aplicação desktop desenvolvida como parte de uma dissertação de mestrado no **PPGCA — UTFPR**. O objetivo é oferecer aos biólogos uma ferramenta acessível e integrada para análise de dados ecológicos, desde a coleta de ocorrências até a geração de mapas de distribuição potencial.

## Funcionalidades

- **Busca de ocorrências** — integração com iNaturalist, GBIF e SpeciesLink
- **Variáveis ambientais** — coleta automática via Google Earth Engine (WorldClim, Sentinel-2)
- **Interações bióticas** — busca no Global Biotic Interactions (GloBI)
- **Modelos de distribuição** — MaxEnt, GAM, Random Forest, SVM e BRT
- **Mapas de predição** — geração automática de mapas de distribuição potencial por país
- **Exportação** — resultados exportáveis em CSV e imagens PNG

## Download

Acesse a [página de releases](../../releases/latest) para baixar o instalador da versão mais recente.

| Sistema | Arquivo |
|---|---|
| Windows | `EcoLab.exe` |
| Linux | `EcoLab` |

## Instalação

### Windows
1. Baixe o instalador `EcoLab_Setup_v*.exe`
2. Execute como administrador
3. Siga o assistente de instalação
4. O EcoLab será instalado em `Program Files\EcoLab`

> Na primeira execução, o banco de dados do GloBI será baixado automaticamente em segundo plano (~20–30 min). Você pode usar as outras funcionalidades normalmente enquanto aguarda.

### Linux
1. Baixe o executável `EcoLab`
2. Dê permissão de execução:
```bash
chmod +x EcoLab
./EcoLab
```

## Pré-requisitos

### Google Earth Engine
Para usar as variáveis ambientais é necessário ter uma conta no [Google Earth Engine](https://earthengine.google.com/) com um projeto no Google Cloud configurado.

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie ou selecione um projeto
3. Copie o **Project ID**
4. Na tela de autenticação do EcoLab, cole o Project ID e clique em autenticar

## Fluxo de uso

```
1. Selecionar espécies
        ↓
2. Configurar fontes de ocorrência (GBIF, iNaturalist, SpeciesLink)
        ↓
3. Configurar interações bióticas (GloBI)
        ↓
4. Configurar variáveis ambientais (GEE)
        ↓
5. Selecionar modelos e métricas
        ↓
6. Visualizar mapas de distribuição potencial
```

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Python 3.11 + FastAPI + Uvicorn |
| Frontend | React + Material UI |
| Dados de ocorrência | iNaturalist, GBIF, SpeciesLink |
| Variáveis ambientais | Google Earth Engine |
| Interações bióticas | GloBI (DuckDB) |
| Modelos | scikit-learn (MaxEnt, Random Forest, SVM, BRT), pygam (GAM) |
| Geodados | GeoPandas, PyOGRIO, Shapely |
| Empacotamento | PyInstaller + Inno Setup |

## Desenvolvimento

```bash
# Clonar o repositório
git clone https://github.com/EcoToolBox/EcoLab

# Criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux

# Instalar dependências
pip install -r requirements.txt

# Iniciar o backend
cd scripts
python run_exe.py

# Iniciar o frontend (outro terminal)
cd ecoLab/frontend
npm install
npm start
```

## Build

```bash
# Gerar executável
pyinstaller EcoLab.spec          # Windows
pyinstaller EcoLab-Linux.spec    # Linux

```

O build também é executado automaticamente via GitHub Actions a cada push na branch `main`.

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE) para mais informações.

---

<div align="center">
  Desenvolvido no <strong>PPGCA — UTFPR</strong>
</div>