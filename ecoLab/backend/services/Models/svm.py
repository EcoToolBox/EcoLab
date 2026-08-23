from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import roc_auc_score
import pandas as pd
import numpy as np
from .validation import run_validation


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
    print("Running SVM model")

    X, y, coords = _prepare(df, feature_cols)

    def build_estimator():
        return Pipeline([
            ("scaler", StandardScaler()),
            ("clf", SVC(
                kernel="rbf", C=1.0, gamma="scale",
                class_weight="balanced", probability=True, random_state=42,
            )),
        ])

    cv_result = run_validation(
        X, y, coords, build_estimator, selected_metrics,
        validation_mode=validation_mode, n_folds=n_folds,
    )

    # Modelo final treinado com 100% dos dados — usado para gerar os mapas.
    model = build_estimator()
    model.fit(X, y)

    base_auc = cv_result["metrics"].get("auc")
    if base_auc is None:
        base_auc = float(roc_auc_score(y, model.predict_proba(X)[:, 1]))

    feature_importance = {}
    for col in feature_cols:
        X_perm = X.copy()
        X_perm[col] = np.random.permutation(X_perm[col].values)
        y_prob_perm = model.predict_proba(X_perm)[:, 1]
        perm_auc = roc_auc_score(y, y_prob_perm)
        feature_importance[col] = float(base_auc - perm_auc)
    feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))

    print("Métricas:", cv_result["metrics"])
    print("Importância das variáveis (queda no AUC por permutação):")
    for feat, imp in feature_importance.items():
        print(f"  {feat}: {imp:.4f}")

    return {
        "model": model,
        "report": cv_result["report"],
        "feature_importance": feature_importance,
        "feature_cols": feature_cols,
        "metrics": cv_result["metrics"],
        "metrics_std": cv_result["metrics_std"],
        "fold_metrics": cv_result["fold_metrics"],
        "validation_mode": cv_result["validation_mode"],
        "n_folds": cv_result["n_folds"],
    }
