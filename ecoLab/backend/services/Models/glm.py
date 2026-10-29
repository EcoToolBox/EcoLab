"""
GLM (regressão logística), no formato do GLM padrão do biomod2: termos
lineares + quadráticos de cada variável (sem interações), com as variáveis
padronizadas. A importância segue o método do biomod2: 1 - correlação entre a
previsão original e a previsão com a variável embaralhada.
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

from .random_forest import _prepare
from .validation import run_validation


def _add_quadratic(X):
    X = np.asarray(X, dtype=float)
    return np.hstack([X, X ** 2])


def build_glm():
    return make_pipeline(
        StandardScaler(),
        FunctionTransformer(_add_quadratic),
        LogisticRegression(C=1e4, max_iter=5000),
    )


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


def run(
    df: pd.DataFrame,
    feature_cols: list[str],
    selected_metrics: list[str] = [],
    validation_mode: str = "random",
    n_folds: int = 10,
) -> dict:
    print("Running GLM model")

    X, y, coords = _prepare(df, feature_cols)

    cv_result = run_validation(
        X, y, coords, build_glm, selected_metrics,
        validation_mode=validation_mode, n_folds=n_folds,
    )

    model = build_glm()
    model.fit(X, y)
    feature_importance = permutation_importance_biomod(model, X)

    print("Métricas:", cv_result["metrics"])
    return {
        "model": model,
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
