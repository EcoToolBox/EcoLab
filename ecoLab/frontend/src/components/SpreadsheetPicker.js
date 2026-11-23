import { useState } from "react";
import {
  Alert, Box, Button, Collapse, FormControl, FormHelperText, InputLabel, MenuItem, Select,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, Paper,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useT } from "../i18n";
import { BRAND } from "../layout/Theme";
import { readSpreadsheetHeaders } from "../utils/parseSpreadsheetHeaders";
import { guessMapping } from "../utils/data";

/**
 * Escolher uma planilha e indicar as colunas. As colunas são reconhecidas
 * pelo nome automaticamente; o usuário só confere (antes era uma tela inteira).
 *
 * fields: [{ key, label, required, helper, optional }]  (optional = fica em "mais campos")
 */
export default function SpreadsheetPicker({ upload, file, fields, aliases, onFile, onMapping, children }) {
  const t = useT();
  const [error, setError] = useState(null);
  const [reading, setReading] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const fileMissing = upload.fileName && !file;

  const choose = async (event) => {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    setReading(true);
    setError(null);
    try {
      const { columns, preview } = await readSpreadsheetHeaders(f);
      onFile(f, { fileName: f.name, columns, preview, mapping: guessMapping(columns, aliases) });
    } catch (e) {
      setError(e.message);
    } finally {
      setReading(false);
    }
  };

  const main = fields.filter((f) => !f.optional);
  const extra = fields.filter((f) => f.optional);
  const select = (f) => (
    <FormControl key={f.key} size="small" fullWidth>
      <InputLabel>{f.label + (f.required ? " *" : "")}</InputLabel>
      <Select
        value={upload.mapping?.[f.key] ?? ""}
        label={f.label + (f.required ? " *" : "")}
        onChange={(e) => onMapping({ ...upload.mapping, [f.key]: e.target.value })}
        error={f.required && !upload.mapping?.[f.key] && upload.columns.length > 0}
      >
        <MenuItem value="">
          <em>{t("sheet.none")}</em>
        </MenuItem>
        {upload.columns.map((c) => (
          <MenuItem key={c} value={c}>
            {c}
          </MenuItem>
        ))}
      </Select>
      {f.helper && <FormHelperText>{f.helper}</FormHelperText>}
    </FormControl>
  );

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={reading}>
          {upload.fileName && file ? t("sheet.change") : t("sheet.choose")}
          <input type="file" accept=".csv,.tsv,.txt" hidden onChange={choose} />
        </Button>
        {upload.fileName && (
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {upload.fileName}
          </Typography>
        )}
        {!upload.fileName && (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {t("sheet.formats")}
          </Typography>
        )}
      </Box>
      {fileMissing && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {t("sheet.reselect")}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}

      {upload.columns.length > 0 && (
        <Box sx={{ mt: 2.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            {t("sheet.columnsTitle")}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            {t("sheet.columnsHelp")}
          </Typography>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
            {main.map(select)}
          </Box>
          {extra.length > 0 && (
            <>
              <Button
                size="small"
                color="inherit"
                sx={{ mt: 1.5 }}
                onClick={() => setShowOptional((s) => !s)}
                endIcon={<ExpandMoreIcon sx={{ transform: showOptional ? "rotate(180deg)" : "none" }} />}
              >
                {t("sheet.optional")}
              </Button>
              <Collapse in={showOptional}>
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, mt: 1.5 }}>
                  {extra.map(select)}
                </Box>
              </Collapse>
            </>
          )}

          {children}

          {upload.preview?.length > 0 && (
            <>
              <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 2.5, mb: 0.5 }}>
                {t("sheet.preview")}
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderColor: BRAND.border, maxHeight: 220 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {upload.columns.map((c) => {
                        const used = Object.values(upload.mapping ?? {}).includes(c);
                        return (
                          <TableCell key={c} sx={{ fontWeight: used ? 600 : 400, color: used ? "secondary.dark" : "text.secondary", whiteSpace: "nowrap" }}>
                            {c}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {upload.preview.map((row, i) => (
                      <TableRow key={i}>
                        {upload.columns.map((c) => (
                          <TableCell key={c} sx={{ whiteSpace: "nowrap" }}>
                            {row[c]}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
