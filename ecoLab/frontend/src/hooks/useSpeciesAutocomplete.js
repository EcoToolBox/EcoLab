import { useState, useEffect } from "react";
import taxonomyApi from "../services/taxonomyApi";
import { useDebounce } from "./useDebounce";

export function useSpeciesAutocomplete() {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    taxonomyApi
      .autocomplete(debouncedQuery)
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return { query, setQuery, options, loading };
}
