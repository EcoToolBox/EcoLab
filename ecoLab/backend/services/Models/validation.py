from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split

from .metrics import calculate_boyce, calculate_tss

VALID_MODES = {"random", "spatial"}


def compute_metrics(y_true: np.ndarray, y_prob: np.ndarray, selected_metrics: list[str]) -> dict:
    """Calcula as métricas selecionadas para um conjunto (true, prob)."""
    metrics = {}
    if "auc" in selected_metrics:
        try:
            metrics["auc"] = float(roc_auc_score(y_true, y_prob))
        except ValueError:
            metrics["auc"] = None
    if "tss" in selected_metrics:
        metrics["tss"] = calculate_tss(y_true, y_prob)
    if "boyce" in selected_metrics:
        metrics["boyce"] = calculate_boyce(y_true, y_prob)
    return metrics


def make_spatial_fold_labels(coords: pd.DataFrame, n_folds: int, random_state: int = 42) -> np.ndarray:
    """
    Agrupa os pontos por coordenadas (latitude/longitude) em `n_folds`
    grupos geográficos usando K-means. Cada grupo vira um fold espacial.
    """
    n_folds = max(2, min(n_folds, len(coords)))
    coords_arr = coords[["latitude", "longitude"]].to_numpy(dtype=float)
    km = KMeans(n_clusters=n_folds, random_state=random_state, n_init=10)
    return km.fit_predict(coords_arr)


def run_validation(
    X: pd.DataFrame,
    y: pd.Series,
    coords: pd.DataFrame,
    build_estimator,
    selected_metrics: list[str],
    validation_mode: str = "random",
    n_folds: int = 10,
    random_state: int = 42,
) -> dict:
    if validation_mode not in VALID_MODES:
        raise ValueError(f"validation_mode inválido: {validation_mode!r}. Use 'random' ou 'spatial'.")

    if validation_mode == "spatial":
        return _run_spatial_validation(
            X, y, coords, build_estimator, selected_metrics, n_folds, random_state
        )
    return _run_random_validation(X, y, build_estimator, selected_metrics, random_state)


def _run_random_validation(X, y, build_estimator, selected_metrics, random_state) -> dict:
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=random_state, stratify=y
        )
    except ValueError:
        print("⚠️  Stratify falhou — usando split sem estratificação.")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=random_state
        )

    for split_name, split_y in [("treino", y_train), ("teste", y_test)]:
        if split_y.nunique() < 2:
            raise ValueError(
                f"Split de {split_name} ficou com apenas uma classe após divisão. "
                "Aumente o número de amostras ou reduza o test_size."
            )

    estimator = build_estimator()
    estimator.fit(X_train, y_train)
    y_prob = estimator.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    metrics = compute_metrics(y_test.to_numpy(), y_prob, selected_metrics)
    report = classification_report(y_test, y_pred, output_dict=True)

    return {
        "validation_mode": "random",
        "n_folds": None,
        "metrics": metrics,
        "metrics_std": None,
        "fold_metrics": None,
        "report": report,
    }


def _run_spatial_validation(X, y, coords, build_estimator, selected_metrics, n_folds, random_state) -> dict:
    if len(coords) != len(X):
        raise ValueError("coords e X precisam ter o mesmo número de linhas para a validação espacial.")

    labels = make_spatial_fold_labels(coords, n_folds, random_state)

    fold_results = []
    all_y_test, all_y_prob = [], []

    for fold_id in sorted(set(labels)):
        test_mask = labels == fold_id
        train_mask = ~test_mask

        y_train_fold = y[train_mask]
        y_test_fold = y[test_mask]

        if y_train_fold.nunique() < 2 or y_test_fold.nunique() < 2:
            print(f"  Fold espacial {fold_id} ignorado: faltam as duas classes em treino/teste.")
            continue

        estimator = build_estimator()
        estimator.fit(X[train_mask], y_train_fold)
        y_prob_fold = estimator.predict_proba(X[test_mask])[:, 1]

        fold_metrics = compute_metrics(y_test_fold.to_numpy(), y_prob_fold, selected_metrics)
        fold_metrics["fold"] = int(fold_id)
        fold_metrics["n_test"] = int(test_mask.sum())
        fold_results.append(fold_metrics)

        all_y_test.append(y_test_fold.to_numpy())
        all_y_prob.append(y_prob_fold)

    if not fold_results:
        raise ValueError(
            "Não foi possível formar folds espaciais válidos "
            "(cada fold precisa ter as duas classes em treino e teste). "
            "Tente reduzir o número de folds espaciais."
        )

    mean_metrics, std_metrics = {}, {}
    for key in selected_metrics:
        vals = [f[key] for f in fold_results if f.get(key) is not None]
        mean_metrics[key] = float(np.mean(vals)) if vals else None
        std_metrics[key] = float(np.std(vals)) if vals else None

    y_test_concat = np.concatenate(all_y_test)
    y_prob_concat = np.concatenate(all_y_prob)
    y_pred_concat = (y_prob_concat >= 0.25).astype(int)
    report = classification_report(y_test_concat, y_pred_concat, output_dict=True)

    print(
        f"Validação espacial: {len(fold_results)} folds válidos "
        f"(de {n_folds} solicitados). Métricas médias: {mean_metrics}"
    )

    return {
        "validation_mode": "spatial",
        "n_folds": len(fold_results),
        "metrics": mean_metrics,
        "metrics_std": std_metrics,
        "fold_metrics": fold_results,
        "report": report,
    }
