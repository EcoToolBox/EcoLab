from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.preprocessing import StandardScaler
import pandas as pd
import numpy as np
from .metrics import calculate_boyce, calculate_tss

def run(df: pd.DataFrame, feature_cols: list[str], selected_metrics: list[str] = []) -> dict:
    print("Running SVM model")

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

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = SVC(
        kernel="rbf",
        C=1.0,
        gamma="scale",
        class_weight="balanced",
        probability=True,
        random_state=42,
    )

    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]
    y_test_np = y_test.values

    report = classification_report(y_test, y_pred, output_dict=True)

    base_auc = roc_auc_score(y_test_np, y_prob)
    feature_importance = {}
    for col in feature_cols:
        X_perm = X_test.copy()
        X_perm[col] = np.random.permutation(X_perm[col].values)
        y_prob_perm = model.predict_proba(scaler.transform(X_perm))[:, 1]
        perm_auc = roc_auc_score(y_test_np, y_prob_perm)
        feature_importance[col] = float(base_auc - perm_auc)

    feature_importance = dict(
        sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    )

    metrics = {}

    if "auc" in selected_metrics:
        metrics["auc"] = float(base_auc)

    if "tss" in selected_metrics:
        metrics["tss"] = calculate_tss(y_test_np, y_prob)

    if "boyce" in selected_metrics:
        metrics["boyce"] = calculate_boyce(y_test_np, y_prob)

    print("Métricas:", metrics)
    print("Importância das variáveis (queda no AUC por permutação):")
    for feat, imp in feature_importance.items():
        print(f"  {feat}: {imp:.4f}")

    return {
        "model": model,
        "scaler": scaler,
        "report": report,
        "feature_importance": feature_importance,
        "feature_cols": feature_cols,
        "metrics": metrics,
    }