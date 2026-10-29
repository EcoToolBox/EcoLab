import numpy as np

def calculate_boyce(y_true, y_prob, bins=10):
    presence_probs = y_prob[y_true == 1]
    bin_edges = np.linspace(0, 1, bins + 1)
    predicted_freq = np.histogram(y_prob, bins=bin_edges)[0]
    presence_freq = np.histogram(presence_probs, bins=bin_edges)[0]
    predicted_freq = predicted_freq / predicted_freq.sum() if predicted_freq.sum() > 0 else predicted_freq
    presence_freq = presence_freq / presence_freq.sum() if presence_freq.sum() > 0 else presence_freq
    valid = predicted_freq > 0
    if valid.sum() < 2:
        return None
    ratio = np.where(valid, presence_freq / (predicted_freq + 1e-10), np.nan)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    valid_idx = ~np.isnan(ratio)
    return float(np.corrcoef(bin_centers[valid_idx], ratio[valid_idx])[0, 1])


def best_tss_threshold(y_true, y_prob):
    """Limiar que maximiza o TSS (sensibilidade + especificidade - 1), como no biomod2."""
    from sklearn.metrics import roc_curve

    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob, dtype=float)
    if len(np.unique(y_true)) < 2:
        return 0.5
    fpr, tpr, thr = roc_curve(y_true, y_prob)
    i = int(np.argmax(tpr - fpr))
    return float(min(max(thr[i], 0.0), 1.0))


def calculate_tss(y_true, y_prob, threshold=0.5):
    """TSS num limiar fixo, ou no limiar ótimo se threshold=None (padrão do biomod2)."""
    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob, dtype=float)
    if threshold is None:
        threshold = best_tss_threshold(y_true, y_prob)
    y_pred = (y_prob >= threshold).astype(int)
    tp = ((y_pred == 1) & (y_true == 1)).sum()
    fp = ((y_pred == 1) & (y_true == 0)).sum()
    tn = ((y_pred == 0) & (y_true == 0)).sum()
    fn = ((y_pred == 0) & (y_true == 1)).sum()
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    return float(sensitivity + specificity - 1)
