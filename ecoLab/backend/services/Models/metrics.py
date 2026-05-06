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


def calculate_tss(y_true, y_prob, threshold=0.5):
    y_pred = (y_prob >= threshold).astype(int)
    tp = ((y_pred == 1) & (y_true == 1)).sum()
    fp = ((y_pred == 1) & (y_true == 0)).sum()
    tn = ((y_pred == 0) & (y_true == 0)).sum()
    fn = ((y_pred == 0) & (y_true == 1)).sum()
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    return float(sensitivity + specificity - 1)
