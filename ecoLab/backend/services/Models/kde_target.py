"""
Modo experimental: a variável resposta deixa de ser presença binária (1/0) e
passa a ser a densidade das ocorrências (KDE), de 0 a 1.

Como funciona:
  1. Os pontos de treino continuam sendo as presenças + o background sorteado
     do grid (mesma razão e buffer de sempre).
  2. Em cada um desses pontos calcula-se a densidade de kernel (gaussiano,
     distância geodésica) das ocorrências da espécie, normalizada para 0-1
     (1 = ponto de maior densidade). Isso vai para a coluna `presence_kde`.
  3. Os modelos são de regressão (GAM, RF, BRT) e aprendem essa
     densidade. A previsão, cortada em 0-1, vira o mapa.
  4. A avaliação (AUC, TSS, Boyce) continua sendo feita contra a presença
     original (1/0) dos dados de teste, para poder comparar com o modo binário
     e com os artigos.

MaxEnt e SVM não entram: o MaxEnt é, por definição, presença/background.

Atenção na interpretação: a densidade das ocorrências também carrega o viés de
amostragem (onde se coletou mais), e pontos vizinhos têm valores parecidos;
a validação espacial é a mais indicada nesse modo.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.neighbors import KernelDensity

from . import random_forest
from .random_forest import _prepare
from .validation import run_validation

EARTH_RADIUS_KM = 6371.0088
KDE_COL = "presence_kde"
SUPPORTED_MODELS = ("gam", "random_forest", "brt")
UNSUPPORTED_MSG = "não suporta o modo KDE (use GAM, Random Forest ou BRT)."


def permutation_importance_biomod(model, X: pd.DataFrame, n_repeats: int = 3, random_state: int = 42) -> dict:
    """Importância no estilo biomod2: 1 - cor(previsão, previsão com a variável embaralhada)."""
    rng = np.random.default_rng(random_state)
    base = model.predict_proba(X)[:, 1]
    importance = {}
    for col in X.columns:
        scores = []
        for _ in range(n_repeats):
            Xp = X.copy()
            Xp[col] = rng.permutation(Xp[col].to_numpy())
            pred = model.predict_proba(Xp)[:, 1]
            if np.std(base) == 0 or np.std(pred) == 0:
                scores.append(0.0)
            else:
                scores.append(1.0 - float(np.corrcoef(base, pred)[0, 1]))
        importance[col] = float(np.mean(scores))
    return dict(sorted(importance.items(), key=lambda kv: kv[1], reverse=True))



def silverman_bandwidth_km(lat: np.ndarray, lon: np.ndarray) -> float:
    """Regra de Silverman em km a partir da dispersão das ocorrências."""
    lat = np.asarray(lat, dtype=float)
    lon = np.asarray(lon, dtype=float)
    n = len(lat)
    if n < 2:
        return 50.0
    km_per_deg = np.pi * EARTH_RADIUS_KM / 180.0
    sd_y = np.std(lat, ddof=1) * km_per_deg
    sd_x = np.std(lon, ddof=1) * km_per_deg * np.cos(np.radians(np.mean(lat)))
    sigma = np.sqrt((sd_x ** 2 + sd_y ** 2) / 2.0)
    bw = 1.06 * sigma * n ** (-1 / 5)
    return float(max(bw, 1.0))


def add_kde_target(train_df: pd.DataFrame, occurrences: pd.DataFrame, bandwidth_km: float | None = None) -> tuple[pd.DataFrame, float]:
    """Acrescenta `presence_kde` (0-1) a cada linha de treino. Retorna (df, banda usada em km)."""
    occ = occurrences.dropna(subset=["latitude", "longitude"])
    if occ.empty:
        raise ValueError("Não há ocorrências com coordenadas para calcular o KDE.")
    lat = occ["latitude"].astype(float).to_numpy()
    lon = occ["longitude"].astype(float).to_numpy()
    bw = float(bandwidth_km) if bandwidth_km and bandwidth_km > 0 else silverman_bandwidth_km(lat, lon)

    kde = KernelDensity(kernel="gaussian", metric="haversine", bandwidth=bw / EARTH_RADIUS_KM)
    kde.fit(np.radians(np.column_stack([lat, lon])))
    pts = np.radians(train_df[["latitude", "longitude"]].astype(float).to_numpy())
    log_d = kde.score_samples(pts)
    dens = np.exp(log_d - np.max(log_d))  # normalizado: 1 no ponto mais denso

    out = train_df.copy()
    out[KDE_COL] = dens
    print(f"KDE das ocorrências: banda {bw:.1f} km, {len(occ)} ocorrências, "
          f"densidade média presenças {dens[out['presence'].to_numpy() == 1].mean():.2f} / "
          f"background {dens[out['presence'].to_numpy() == 0].mean():.2f}")
    return out, bw


class KDETargetEstimator:
    """
    Recebe o y binário (usado só na avaliação) mas treina o regressor na
    densidade KDE das mesmas linhas. predict_proba devolve a previsão em 0-1,
    então validação, ensemble e mapas funcionam sem mudança.
    """

    def __init__(self, regressor, target: pd.Series):
        self.regressor = regressor
        self.target = target

    def fit(self, X, y=None):
        self.regressor.fit(X, self.target.loc[X.index].to_numpy(dtype=float))
        return self

    def predict_proba(self, X):
        p = np.clip(np.nan_to_num(np.asarray(self.regressor.predict(X), dtype=float).reshape(-1), nan=0.0), 0.0, 1.0)
        return np.column_stack([1.0 - p, p])

    @property
    def feature_importances_(self):
        return getattr(self.regressor, "feature_importances_", None)


class _LinearGAMRegressor:
    """pygam LinearGAM com um termo suave por variável; lam escolhido uma vez e reaproveitado."""

    def __init__(self, n_features: int, lam=None):
        from pygam import LinearGAM, s

        terms = s(0)
        for i in range(1, n_features):
            terms += s(i)
        self.gam = LinearGAM(terms)
        self.lam = lam
        if lam is not None:
            self.gam.set_params(lam=lam)

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        if self.lam is None:
            self.gam.gridsearch(X, y, progress=False)
            self.lam = self.gam.lam
        else:
            self.gam.fit(X, y)
        return self

    def predict(self, X):
        return self.gam.predict(np.asarray(X, dtype=float))


def _regressor_factory(model: str, n_features: int, lam=None):
    if model == "random_forest":
        return lambda: RandomForestRegressor(
            n_estimators=500, min_samples_leaf=5, max_features=1 / 3,
            random_state=42, n_jobs=random_forest.N_JOBS,
        )
    if model == "brt":
        return lambda: GradientBoostingRegressor(
            n_estimators=100, learning_rate=0.05, max_depth=5, subsample=0.75, random_state=42,
        )
    if model == "gam":
        return lambda: _LinearGAMRegressor(n_features, lam=lam)
    raise ValueError(f"{model} {UNSUPPORTED_MSG}")


def run(
    model: str,
    df: pd.DataFrame,
    feature_cols: list[str],
    selected_metrics: list[str] = [],
    validation_mode: str = "random",
    n_folds: int = 10,
) -> dict:
    if model not in SUPPORTED_MODELS:
        raise ValueError(f"{model} {UNSUPPORTED_MSG}")
    if KDE_COL not in df.columns:
        raise ValueError("Coluna de densidade (KDE) ausente nos dados de treino.")
    print(f"Running {model} (KDE)")

    X, y, coords = _prepare(df, feature_cols)
    target = df.loc[X.index, KDE_COL].astype(float)

    lam = None
    if model == "gam":  # escolhe a suavização uma vez, no conjunto completo
        lam = _LinearGAMRegressor(len(feature_cols)).fit(X, target.to_numpy()).lam
    make_reg = _regressor_factory(model, len(feature_cols), lam)

    def build_estimator():
        return KDETargetEstimator(make_reg(), target)

    cv_result = run_validation(
        X, y, coords, build_estimator, selected_metrics,
        validation_mode=validation_mode, n_folds=n_folds,
    )

    final = build_estimator().fit(X, y)
    pred = final.predict_proba(X)[:, 1]
    ss_res = float(np.sum((target.to_numpy() - pred) ** 2))
    ss_tot = float(np.sum((target.to_numpy() - target.mean()) ** 2)) or 1.0
    r2 = 1.0 - ss_res / ss_tot

    imp = final.feature_importances_
    if imp is not None:
        feature_importance = dict(sorted(
            {c: float(v) for c, v in zip(feature_cols, imp)}.items(), key=lambda kv: kv[1], reverse=True
        ))
    else:
        feature_importance = permutation_importance_biomod(final, X)

    print(f"Métricas (vs presença 1/0): {cv_result['metrics']} | R² do ajuste ao KDE: {r2:.3f}")
    return {
        "model": final,
        "report": cv_result["report"],
        "feature_importance": feature_importance,
        "feature_cols": feature_cols,
        "metrics": cv_result["metrics"],
        "metrics_std": cv_result["metrics_std"],
        "fold_metrics": cv_result["fold_metrics"],
        "oof": cv_result.get("oof"),
        "validation_mode": cv_result["validation_mode"],
        "n_folds": cv_result["n_folds"],
        "target": "kde",
        "kde_r2": r2,
    }
