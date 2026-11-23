import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import pt from "./pt";
import en from "./en";

// Português é o idioma de referência: toda chave existe nele. Se faltar uma
// chave em inglês, cai no português em vez de mostrar a chave crua.
const DICTS = { pt, en };
const STORAGE_KEY = "ecolab.lang";

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
}

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch {
    // navegador sem localStorage: usa o padrão
  }
  return "pt";
}

const I18nContext = createContext({ lang: "pt", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  const setLang = useCallback((next) => {
    if (!DICTS[next]) return;
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignora
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  }, [lang]);

  const t = useCallback(
    (key, vars) => {
      const value = lookup(DICTS[lang], key) ?? lookup(DICTS.pt, key);
      if (typeof value === "string") return interpolate(value, vars);
      if (value !== undefined) return value; // listas/objetos (ex.: mensagens de progresso)
      return key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useContext(I18nContext).t;
}

/** Formata números no idioma atual (vírgula decimal em português). */
export function useNumber() {
  const { lang } = useI18n();
  return useCallback(
    (value, digits = 0) => {
      if (value == null || Number.isNaN(Number(value))) return "–";
      return Number(value).toLocaleString(lang === "pt" ? "pt-BR" : "en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    },
    [lang]
  );
}
