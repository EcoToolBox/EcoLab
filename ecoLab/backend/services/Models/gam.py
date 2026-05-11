from pygam import LogisticGAM, s
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
import pandas as pd
import numpy as np
from .metrics import calculate_boyce, calculate_tss



def run(df: pd.DataFrame, feature_cols: list[str], selected_metrics: list[str] = []) -> dict:
    print("Running GAM model")

    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Colunas ausentes no DataFrame: {missing}")

    X = df[feature_cols].copy()
    y = df["presence"].copy()

    mask = X.notna().all(axis=1)
    X, y = X[mask], y[mask]

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

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    except ValueError:
        print("⚠️  Stratify falhou — usando split sem estratificação.")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

    for split_name, split_y in [("treino", y_train), ("teste", y_test)]:
        if len(split_y.unique()) < 2:
            raise ValueError(
                f"Split de {split_name} ficou com apenas uma classe após divisão. "
                "Aumente o número de amostras ou reduza o test_size."
            )

    terms = s(0)
    for i in range(1, len(feature_cols)):
        terms += s(i)

    model = LogisticGAM(terms)
    model.gridsearch(X_train.values, y_train.values)

    y_pred = (model.predict_proba(X_test.values) >= 0.5).astype(int)
    y_prob = model.predict_proba(X_test.values)

    report = classification_report(y_test, y_pred, output_dict=True)

    feature_importance = {}
    for i, col in enumerate(feature_cols):
        xi = np.linspace(X[col].min(), X[col].max(), 100)
        Xi = np.tile(X.mean().values, (100, 1))
        Xi[:, i] = xi
        contrib = model.partial_dependence(term=i, X=Xi)
        feature_importance[col] = float(np.std(contrib))

    feature_importance = dict(
        sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    )

    print("Importância das variáveis (std da contribuição):")
    for feat, imp in feature_importance.items():
        print(f"  {feat}: {imp:.4f}")

    metrics = {}
    y_test_np = y_test.values

    if "auc" in selected_metrics:
        metrics["auc"] = float(roc_auc_score(y_test_np, y_prob))

    if "tss" in selected_metrics:
        metrics["tss"] = calculate_tss(y_test_np, y_prob)

    if "boyce" in selected_metrics:
        boyce = calculate_boyce(y_test_np, y_prob)
        metrics["boyce"] = boyce

    return {
        "model": model,
        "report": report,
        "feature_importance": feature_importance,
        "feature_cols": feature_cols,
        "X_train": X_train,
        "metrics": metrics,
    }