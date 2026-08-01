<div align="center">

# 🖥️ EcoLab

### Desktop application for Species Distribution Modeling

*An open-source platform that automates biodiversity data collection, environmental variable extraction, and species distribution modeling.*

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Python](https://img.shields.io/badge/python-3.11+-blue)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)

Part of the **EcoToolBox** ecosystem 🌿

</div>

---

# ✨ Overview

**EcoLab** is an open-source desktop application designed to simplify **Species Distribution Modeling (SDM)**.

Instead of manually collecting biodiversity records, environmental variables, and ecological interactions from multiple sources, EcoLab integrates the entire workflow into a single application.

The platform enables researchers to retrieve occurrence records, extract environmental variables, train machine learning models, and generate habitat suitability maps with minimal manual effort.

---

# 🚀 Features

- 🦋 Retrieve species occurrence records
- 🌎 Download environmental variables
- 🌿 Extract NDVI and NDWI from Sentinel-2
- 🌡️ Retrieve climate variables from WorldClim
- 🌐 Query ecological interactions from GloBI
- 🤖 Train Species Distribution Models
- 🗺️ Generate habitat suitability maps
- 📊 Interactive desktop interface

---

# 🧩 EcoToolBox Ecosystem

EcoLab integrates the other projects in the EcoToolBox ecosystem.

| Project | Purpose |
|---------|---------|
| 🌍 EcoEnv | Environmental variables |
| 🦋 EcoObs | Species occurrence records |
| 🌿 EcoInteract | Ecological interactions |

---

# 🏗️ Architecture

```text
                User
                  │
                  ▼
             React Frontend
                  │
                  ▼
           FastAPI Backend
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
 EcoObs       EcoEnv      EcoInteract
    │             │             │
    └─────────────┼─────────────┘
                  ▼
      Species Distribution Models
                  ▼
      Habitat Suitability Maps
```

---

# 🔬 Data Sources

EcoLab integrates data from internationally recognized biodiversity repositories.

| Source | Purpose |
|---------|---------|
| GBIF | Species occurrence records |
| iNaturalist | Citizen science observations |
| SpeciesLink | Brazilian biodiversity records |
| Sentinel-2 | NDVI and NDWI |
| WorldClim | Climate variables |
| GloBI | Ecological interactions |

---

# 🤖 Machine Learning

EcoLab currently supports several machine learning algorithms for Species Distribution Modeling, including:

- Random Forest
- MaxEnt
- Logistic Regression
- Support for additional algorithms through scikit-learn

---

# 💻 Technology Stack

### Backend

- Python
- FastAPI
- Uvicorn

### Frontend

- React
- Material UI

### Data Science

- Pandas
- GeoPandas
- NumPy
- Scikit-learn

### Geospatial

- Rasterio
- Shapely
- Google Earth Engine

---

# 📷 Screenshots

> Screenshots will be added soon.

---

# 📄 Scientific Publications

EcoLab has been developed as part of a Master's research project in Applied Computing at UTFPR and has been presented in peer-reviewed scientific publications.

---

# 📦 Installation

Pre-built installers are available through the GitHub Releases page.

Supported platforms:

- Windows
- Linux
- macOS

---

# 🌱 Related Projects

- 🌍 EcoEnv
- 🦋 EcoObs
- 🌿 EcoInteract

---

# 🤝 Contributing

Contributions are welcome.

Feel free to open issues or submit pull requests.

---

# 📜 License

MIT License.
