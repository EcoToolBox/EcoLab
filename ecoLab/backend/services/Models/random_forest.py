from sklearn.ensemble import RandomForestClassifier
import pandas as pd
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
    print("Running Random Forest model")

    X, y, coords = _prepare(df, feature_cols)

    def build_estimator():
        return RandomForestClassifier(
            n_estimators=500,
            max_depth=None,
            min_samples_leaf=5,
            max_features="sqrt",
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )

    cv_result = run_validation(
        X, y, coords, build_estimator, selected_metrics,
        validation_mode=validation_mode, n_folds=n_folds,
    )

    # Modelo final treinado com 100% dos dados — usado para gerar os mapas.
    model = build_estimator()
    model.fit(X, y)

    feature_importance = pd.Series(
        model.feature_importances_, index=feature_cols
    ).sort_values(ascending=False).to_dict()
    feature_importance = {k: float(v) for k, v in feature_importance.items()}

    print("Métricas:", cv_result["metrics"])
    print("Importância das variáveis:")
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
