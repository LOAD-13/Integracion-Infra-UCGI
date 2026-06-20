import { useEffect, useState } from "react";

/**
 * Devuelve una copia diferida de `value`. Cada vez que `value` cambia se
 * programa un timer de `delayMs` ms; si el valor vuelve a cambiar antes de
 * que dispare, el timer se reinicia. Útil para inputs de búsqueda — evita
 * pegarle al backend en cada tecla.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
