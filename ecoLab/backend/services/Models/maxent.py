from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split
import pandas as pd
import numpy as np
from .metrics import calculate_boyce, calculate_tss


def run(df: pd.DataFrame, feature_cols: list[str], selected_metrics: list[str] = []) -> dict:
    print(df)
    print(df.columns)
    print("Running MaxEnt model (sklearn implementation)")

    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Colunas ausentes no DataFrame: {missing}")

    X = df[feature_cols].copy()
    y = df["presence"].copy()

    mask = X.notna().all(axis=1)
    X, y = X[mask], y[mask]

    X_presence = X[y == 1]
    print(f"Registros de presença: {len(X_presence)}")

    if len(X_presence) < 5:
        raise ValueError(
            f"Apenas {len(X_presence)} registros de presença. "
            "São necessários pelo menos 5."
        )

    n_background = min(10_000, len(X))
    X_background = X.sample(n=n_background, random_state=42)

    X_train = pd.concat([X_presence, X_background], ignore_index=True)
    y_train = np.concatenate([
        np.ones(len(X_presence)),
        np.zeros(len(X_background))
    ])

    X_tr, X_test, y_tr, y_test = train_test_split(
        X_train, y_train, test_size=0.2, random_state=42, stratify=y_train
    )

    scaler = StandardScaler()
    X_tr_scaled = scaler.fit_transform(X_tr)
    X_test_scaled = scaler.transform(X_test)

    model = LogisticRegression(
        penalty="l1",
        solver="saga",
        C=1.0,
        max_iter=1000,
        random_state=42,
    )
    model.fit(X_tr_scaled, y_tr)

    y_prob_test = model.predict_proba(X_test_scaled)[:, 1]

    base_probs = model.predict_proba(scaler.transform(X_presence))[:, 1]
    feature_importance = {}
    for col in feature_cols:
        X_perm = X_presence.copy()
        X_perm[col] = np.random.permutation(X_perm[col].values)
        perm_probs = model.predict_proba(scaler.transform(X_perm))[:, 1]
        feature_importance[col] = float(np.mean(base_probs) - np.mean(perm_probs))

    feature_importance = dict(
        sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    )

    metrics = {}

    if "auc" in selected_metrics:
        metrics["auc"] = float(roc_auc_score(y_test, y_prob_test))

    if "tss" in selected_metrics:
        metrics["tss"] = calculate_tss(y_test, y_prob_test)

    if "boyce" in selected_metrics:
        metrics["boyce"] = calculate_boyce(y_test, y_prob_test)

    print("Métricas:", metrics)
    print("Importância das variáveis:")
    for feat, imp in feature_importance.items():
        print(f"  {feat}: {imp:.4f}")

    return {
        "model": model,
        "scaler": scaler,
        "feature_importance": feature_importance,
        "feature_cols": feature_cols,
        "metrics": metrics,
    }