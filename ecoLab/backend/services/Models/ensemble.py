"""
Ensemble por média ponderada (como o "EMwmean" do biomod2).

- Entram só os modelos cuja métrica escolhida (TSS ou AUC) é >= um mínimo.
- O peso de cada modelo é a sua métrica dividida pela soma das métricas dos
  modelos que entraram.
- A previsão do ensemble é a média ponderada das probabilidades dos modelos.
- A avaliação usa as previsões fora da amostra que cada modelo já gerou na
  validação: em cada fold, combina as previsões dos modelos para os mesmos
  pontos de teste. Assim o ensemble é avaliado nos mesmos dados que os
  modelos individuais, sem reaproveitar dados de treino.
"""
from __future__ import annotations

import numpy as np

from .validation import compute_metrics

WEIGHT_METRICS = ("tss", "auc")


class WeightedEnsemble:
    """Combina modelos já treinados; compatível com predict_proba do sklearn."""

    def __init__(self, members: list[tuple], feature_cols: list[str]):
        self.members = members  # (nome, modelo, peso normalizado)
        self.feature_cols = feature_cols

    def predict_proba(self, X):
        total = np.zeros(len(X), dtype=float)
        for name, model, weight in self.members:
            proba = np.asarray(model.predict_proba(X))
            p = proba[:, 1] if proba.ndim == 2 else proba.reshape(-1)
            total += weight * p
        total = np.clip(total, 0.0, 1.0)
        return np.column_stack([1.0 - total, total])


def _normalized_importance(importance: dict) -> dict:
    values = {}
    for k, v in (importance or {}).items():
        try:
            f = abs(float(v))
        except (TypeError, ValueError):
            continue
        if np.isfinite(f):
            values[k] = f
    s = sum(values.values())
    return {k: v / s for k, v in values.items()} if s > 0 else {}


def build_weighted_ensemble(
    results: dict,
    selected_metrics: list[str],
    weight_metric: str = "tss",
    threshold: float = 0.0,
) -> dict:
    weight_metric = (weight_metric or "tss").lower()
    if weight_metric not in WEIGHT_METRICS:
        raise ValueError(f"Métrica de peso inválida: {weight_metric}. Use TSS ou AUC.")
    if weight_metric not in (selected_metrics or []):
        raise ValueError(
            f"Para o ensemble ponderado por {weight_metric.upper()}, selecione a métrica "
            f"{weight_metric.upper()} na tela de Modelos."
        )

    candidates, skipped = [], []
    for name, res in results.items():
        if name == "ensemble":
            continue
        value = (res.get("metrics") or {}).get(weight_metric)
        if value is None or not np.isfinite(value) or value <= 0 or value < threshold:
            skipped.append({"model": name, "value": value})
            continue
        candidates.append((name, res, float(value)))

    if len(candidates) < 2:
        raise ValueError(
            f"O ensemble precisa de pelo menos 2 modelos com {weight_metric.upper()} >= {threshold:g}; "
            f"apenas {len(candidates)} atingiram. Reduza o mínimo ou selecione mais modelos."
        )

    total = sum(v for _, _, v in candidates)
    members = [(name, res, value / total) for name, res, value in candidates]

    # --- Avaliação nos mesmos folds dos modelos individuais ---
    fold_sets = []
    for _, res, _ in members:
        oof = res.get("oof") or []
        fold_sets.append({o["fold"]: o for o in oof})
    common_folds = sorted(set.intersection(*(set(f) for f in fold_sets))) if fold_sets else []

    fold_results = []
    for fold in common_folds:
        entries = [fs[fold] for fs in fold_sets]
        idx_sets = [dict(zip(e["index"], range(len(e["index"])))) for e in entries]
        common_idx = [i for i in entries[0]["index"] if all(i in s for s in idx_sets[1:])]
        if not common_idx:
            continue
        y = np.array([entries[0]["y"][idx_sets[0][i]] for i in common_idx])
        if len(set(y.tolist())) < 2:
            continue
        p = np.zeros(len(common_idx))
        for (_, _, w), e, s in zip(members, entries, idx_sets):
            p += w * np.array([e["prob"][s[i]] for i in common_idx], dtype=float)
        fm = compute_metrics(y, p, selected_metrics)
        fm["fold"] = int(fold)
        fm["n_test"] = len(common_idx)
        fold_results.append(fm)

    if not fold_results:
        raise ValueError("Não foi possível avaliar o ensemble: os modelos não têm folds de teste em comum.")

    metrics, metrics_std = {}, {}
    for key in selected_metrics:
        vals = [f[key] for f in fold_results if f.get(key) is not None]
        metrics[key] = float(np.mean(vals)) if vals else None
        metrics_std[key] = float(np.std(vals)) if len(vals) > 1 else None

    first = members[0][1]
    validation_mode = first.get("validation_mode")
    single_split = validation_mode == "random"  # "repeated" e "spatial" têm vários folds

    importance: dict[str, float] = {}
    for _, res, w in members:
        for k, v in _normalized_importance(res.get("feature_importance")).items():
            importance[k] = importance.get(k, 0.0) + w * v
    importance = dict(sorted(importance.items(), key=lambda kv: kv[1], reverse=True))

    model = WeightedEnsemble([(n, r["model"], w) for n, r, w in members], first["feature_cols"])

    info = {
        "method": "weighted_mean",
        "weight_metric": weight_metric,
        "threshold": threshold,
        "members": [
            {"model": n, "weight": round(w, 4), weight_metric: round(r["metrics"][weight_metric], 4)}
            for n, r, w in members
        ],
        "excluded": skipped,
    }
    print(f"Ensemble (média ponderada por {weight_metric.upper()}, mínimo {threshold:g}): " +
          ", ".join(f"{m['model']} ({m['weight']:.2f})" for m in info["members"]) +
          f" | métricas: {metrics}")

    return {
        "model": model,
        "feature_cols": first["feature_cols"],
        "feature_importance": importance,
        "metrics": metrics,
        "metrics_std": None if single_split else metrics_std,
        "fold_metrics": None if single_split else fold_results,
        "validation_mode": validation_mode,
        "n_folds": None if single_split else len(fold_results),
        "report": None,
        "oof": None,
        "ensemble_info": info,
    }
