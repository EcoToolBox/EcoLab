from pygam import LogisticGAM, s
import numpy as np
import pandas as pd
from .validation import run_validation


class _GAMEstimator:
    """
    Wrapper fino em volta do LogisticGAM para expor a interface
    fit/predict_proba usada pelo módulo de validação (predict_proba
    devolvendo duas colunas, como no padrão sklearn).
    """

    def __init__(self, n_features: int):
        terms = s(0)
        for i in range(1, n_features):
            terms += s(i)
        self.gam = LogisticGAM(terms)

    def fit(self, X, y):
        X_arr = X.values if hasattr(X, "values") else np.asarray(X)
        y_arr = y.values if hasattr(y, "values") else np.asarray(y)
        self.gam.gridsearch(X_arr, y_arr, progress=False)
        return self

    def predict_proba(self, X):
        X_arr = X.values if hasattr(X, "values") else np.asarray(X)
        p1 = self.gam.predict_proba(X_arr)
        p1 = np.asarray(p1).reshape(-1)
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
    X, y, coords = X[mask], y[mask], coords[mask]

    class_counts = y.value_counts()
    print(f"Registros usados: {len(X)} ({class_counts.get(1, 0)} presenças, {class_counts.get(0, 0)} ausências)")

    if len(class_counts) < 2:
        raise ValueError(
            f"Dados contêm apenas a classe {class_counts.index[0]}. "
            "São necessárias presença (1) e ausência (0) para treinar o modelo."
        )

    min_class_count = class_counts.min()
    if min_class_count < 5:
        raise ValueError(
            f"Classe minoritária tem apenas {min_class_count} amostras. "
            "São necessárias pelo menos 5 amostras por classe."
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

    def build_estimator():
        return _GAMEstimator(n_features)

    cv_result = run_validation(
        X, y, coords, build_estimator, selected_metrics,
        validation_mode=validation_mode, n_folds=n_folds,
    )

    # Modelo final treinado com 100% dos dados — usado para gerar os mapas.
    final_estimator = build_estimator()
    final_estimator.fit(X, y)
    model = final_estimator.gam

    feature_importance = {}
    for i, col in enumerate(feature_cols):
        xi = np.linspace(X[col].min(), X[col].max(), 100)
        Xi = np.tile(X.mean().values, (100, 1))
        Xi[:, i] = xi
        contrib = model.partial_dependence(term=i, X=Xi)
        feature_importance[col] = float(np.std(contrib))
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
        "validation_mode": cv_result["validation_mode"],
        "n_folds": cv_result["n_folds"],
    }
