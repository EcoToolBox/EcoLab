from pygam import LogisticGAM, s
import numpy as np
import pandas as pd
from .validation import run_validation
from .validation import explain_dropped


class _GAMEstimator:
    """
    Wrapper fino em volta do LogisticGAM para expor a interface
    fit/predict_proba usada pelo módulo de validação (predict_proba
    devolvendo duas colunas, como no padrão sklearn).
    """

    def __init__(self, n_features: int, lam=None):
        terms = s(0)
        for i in range(1, n_features):
            terms += s(i)
        self.gam = LogisticGAM(terms)
        # lam fixo = só ajusta (rápido); sem lam = busca o lam (gridsearch,
        # 11 ajustes). A busca é feita uma vez no conjunto completo e o lam
        # escolhido é reaproveitado nas repetições da validação.
        self.lam = lam
        if lam is not None:
            self.gam.set_params(lam=lam)

    def fit(self, X, y):
        X_arr = X.values if hasattr(X, "values") else np.asarray(X)
        y_arr = y.values if hasattr(y, "values") else np.asarray(y)
        if self.lam is None:
            self.gam.gridsearch(X_arr, y_arr, progress=False)
            self.lam = self.gam.lam
        else:
            self.gam.fit(X_arr, y_arr)
        return self

    def predict_proba(self, X):
        X_arr = X.values if hasattr(X, "values") else np.asarray(X)
        p1 = self.gam.predict_proba(X_arr)
        # Com muitas variáveis o LogisticGAM pode estourar (overflow) e
        # devolver NaN; isso quebrava as métricas, o mapa e a resposta.
        p1 = np.nan_to_num(np.asarray(p1, dtype=float).reshape(-1), nan=0.5, posinf=1.0, neginf=0.0)
        p1 = np.clip(p1, 0.0, 1.0)
        return np.column_stack([1 - p1, p1])


def _prepare(df: pd.DataFrame, feature_cols: list[str]):
    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Colunas ausentes no DataFrame: {missing}")

    for col in ("latitude", "longitude"):
        if col not in df.columns:
            raise ValueError(f"Coluna '{col}' é necessária para separar os folds espaciais.")

    X = df[feature_cols].copy()
    y = df["presence"].copy()
    coords = df[["latitude", "longitude"]].copy()

    mask = X.notna().all(axis=1)
    why = explain_dropped(X, y, mask)
    if why:
        print(" ", why.strip())
    X, y, coords = X[mask], y[mask], coords[mask]

    class_counts = y.value_counts()
    print(f"Registros usados: {len(X)} ({class_counts.get(1, 0)} presenças, {class_counts.get(0, 0)} ausências)")

    if len(class_counts) < 2:
        raise ValueError(
            f"Dados contêm apenas a classe {class_counts.index[0]}. "
            "São necessárias presença (1) e ausência (0) para treinar o modelo." + why
        )

    min_class_count = class_counts.min()
    if min_class_count < 5:
        raise ValueError(
            f"Classe minoritária tem apenas {min_class_count} amostras. "
            "São necessárias pelo menos 5 amostras por classe." + why
        )

    return X, y, coords


def run(
    df: pd.DataFrame,
    feature_cols: list[str],
    selected_metrics: list[str] = [],
    validation_mode: str = "random",
    n_folds: int = 10,
) -> dict:
    print("Running GAM model")

    X, y, coords = _prepare(df, feature_cols)
    n_features = len(feature_cols)

    # Modelo final treinado com 100% dos dados (usado nos mapas). É aqui que
    # se escolhe o lam (suavização); as repetições da validação reaproveitam
    # esse lam em vez de refazer a busca a cada repetição (~5x mais rápido).
    final_estimator = _GAMEstimator(n_features).fit(X, y)
    lam = final_estimator.lam

    def build_estimator():
        return _GAMEstimator(n_features, lam=lam)

    cv_result = run_validation(
        X, y, coords, build_estimator, selected_metrics,
        validation_mode=validation_mode, n_folds=n_folds,
    )

    model = final_estimator.gam
    if not np.isfinite(np.asarray(model.coef_, dtype=float)).all():
        print("  Aviso: o GAM não convergiu (coeficientes infinitos/NaN); as previsões podem não ser confiáveis.")

    feature_importance = {}
    for i, col in enumerate(feature_cols):
        xi = np.linspace(X[col].min(), X[col].max(), 100)
        Xi = np.tile(X.mean().values, (100, 1))
        Xi[:, i] = xi
        contrib = model.partial_dependence(term=i, X=Xi)
        value = float(np.nanstd(contrib)) if np.isfinite(contrib).any() else 0.0
        feature_importance[col] = value if np.isfinite(value) else 0.0
    feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))

    print("Importância das variáveis (std da contribuição):")
    for feat, imp in feature_importance.items():
        print(f"  {feat}: {imp:.4f}")

    return {
        "model": final_estimator,
        "report": cv_result["report"],
        "feature_importance": feature_importance,
        "feature_cols": feature_cols,
        "metrics": cv_result["metrics"],
        "metrics_std": cv_result["metrics_std"],
        "fold_metrics": cv_result["fold_metrics"],
        "oof": cv_result.get("oof"),
        "validation_mode": cv_result["validation_mode"],
        "n_folds": cv_result["n_folds"],
    }
