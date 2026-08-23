from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.pipeline import Pipeline
from sklearn.inspection import permutation_importance
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
    n_presence = int(class_counts.get(1, 0))
    n_background = int(class_counts.get(0, 0))
    print(f"Registros usados: {len(X)} ({n_presence} presenças, {n_background} background)")

    if n_presence < 5:
        raise ValueError(f"Apenas {n_presence} registros de presença. São necessários pelo menos 5.")
    if n_background < 5:
        raise ValueError(f"Apenas {n_background} pontos de background. São necessários pelo menos 5.")

    return X, y, coords


def _build_pipeline(C: float = 1.0, use_quadratic: bool = True) -> Pipeline:
    """
    Pipeline que aproxima o MaxEnt clássico:
      - StandardScaler para normalizar as variáveis ambientais;
      - features quadráticas (sem termos de interação) para aproximar as
        "quadratic features" usadas pelo MaxEnt original, permitindo
        respostas em forma de sino em vez de só lineares;
      - regressão logística com regularização L2, que é o equivalente de
        máxima entropia com regularização (o próprio MaxEnt é, na prática,
        uma regressão log-linear regularizada sobre esse tipo de feature
        expandida).
    """
    steps = [("scaler", StandardScaler())]
    if use_quadratic:
        steps.append(("quad", PolynomialFeatures(degree=2, include_bias=False, interaction_only=False)))
        steps.append(("scaler2", StandardScaler()))
        
    steps.append(("clf", LogisticRegression(C=C, max_iter=2000, random_state=42)))
    return Pipeline(steps)


def run(
    df: pd.DataFrame,
    feature_cols: list[str],
    selected_metrics: list[str] = [],
    validation_mode: str = "spatial",
    n_folds: int = 10,
    regularization_c: float = 1.0,
    use_quadratic_features: bool = True,
) -> dict:
    print("Running MaxEnt model (presença/background com features quadráticas + regularização L2)")

    X, y, coords = _prepare(df, feature_cols)

    def build_estimator():
        return _build_pipeline(C=regularization_c, use_quadratic=use_quadratic_features)

    cv_result = run_validation(
        X, y, coords, build_estimator, selected_metrics,
        validation_mode=validation_mode, n_folds=n_folds,
    )

    # Modelo final treinado com 100% dos dados — usado para gerar os mapas.
    model = build_estimator()
    model.fit(X, y)

    perm_result = permutation_importance(
        model, X, y, n_repeats=10, random_state=42, scoring="roc_auc"
    )
    feature_importance = dict(zip(feature_cols, perm_result.importances_mean.tolist()))
    feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))

    print("Métricas:", cv_result["metrics"])
    print("Importância das variáveis:")
    for feat, imp in feature_importance.items():
        print(f"  {feat}: {imp:.4f}")

    return {
        "model": model,
        "feature_importance": feature_importance,
        "feature_cols": feature_cols,
        "metrics": cv_result["metrics"],
        "metrics_std": cv_result["metrics_std"],
        "fold_metrics": cv_result["fold_metrics"],
        "validation_mode": cv_result["validation_mode"],
        "n_folds": cv_result["n_folds"],
        "report": cv_result["report"],
    }
