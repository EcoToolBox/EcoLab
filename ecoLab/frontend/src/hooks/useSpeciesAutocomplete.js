import { useEffect, useState } from "react";
import { useDebounce } from "./useDebounce";
import api from "../services/api";

export function useSpeciesAutocomplete() {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 400);

  useEffect(() => {
    if (debounced.trim().length < 3) {
      setOptions([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    api
      .autocomplete(debounced.trim())
      .then((result) => active && setOptions(Array.isArray(result) ? result : []))
      .catch(() => active && setOptions([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced]);

  return { query, setQuery, options, loading };
}
