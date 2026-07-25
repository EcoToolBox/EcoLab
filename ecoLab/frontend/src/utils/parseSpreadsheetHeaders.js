// Lightweight header + preview-row reader for CSV/TSV files (no external deps).

function detectDelimiter(line) {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  candidates.forEach((delim) => {
    const count = line.split(delim).length;
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  });
  return best;
}

function splitLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/**
 * Reads a CSV/TSV File and resolves with its header columns and a small preview.
 * @param {File} file
 * @param {number} previewRows number of data rows to include in the preview
 * @returns {Promise<{ columns: string[], preview: Record<string,string>[], delimiter: string }>}
 */
export function readSpreadsheetHeaders(file, previewRows = 5) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const lines = text.split(/\r\n|\n/).filter((l) => l.length > 0);
        if (lines.length === 0) {
          reject(new Error("Arquivo vazio."));
          return;
        }
        const delimiter = detectDelimiter(lines[0]);
        const columns = splitLine(lines[0], delimiter);
        const preview = lines.slice(1, 1 + previewRows).map((line) => {
          const cells = splitLine(line, delimiter);
          return columns.reduce((row, col, i) => {
            row[col] = cells[i] ?? "";
            return row;
          }, {});
        });
        resolve({ columns, preview, delimiter });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}
