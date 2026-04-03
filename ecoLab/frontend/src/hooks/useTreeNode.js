import { useState, useCallback } from "react";
import taxonomyApi from "../services/taxonomyApi";

export function useTreeNode(key) {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
  if (loaded) return Promise.resolve();

  setLoading(true);
  setError(null);

  return (key === "root"
    ? taxonomyApi.getRoots()
    : taxonomyApi.getChildren(key)
  )
    .then((data) => {
      const list = Array.isArray(data) ? data
        : Array.isArray(data?.msg) ? data.msg
        : Array.isArray(data?.results) ? data.results
        : [];
      setChildren(list);
      setLoaded(true);
    })
    .catch(() => {
      setError("Erro ao carregar. Tente novamente.");
    })
    .finally(() => {
      setLoading(false);
    });
}, [key, loaded]);

  const reset = useCallback(() => {
    setChildren([]);
    setLoaded(false);
    setError(null);
  }, []);

  return { children, loading, loaded, error, load, reset };
}
