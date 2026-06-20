import { useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutosaveOptions<T> {
  /** Valor que se está editando — el hook compara contra el último guardado. */
  value: T;
  /** Función que persiste el valor. Resuelve cuando la operación termina. */
  onSave: (value: T) => Promise<void>;
  /** Tiempo (ms) de inactividad antes de disparar el save. */
  delayMs?: number;
  /** Si true, no dispara saves. Útil para deshabilitar antes de la carga inicial. */
  disabled?: boolean;
}

/**
 * Guarda automáticamente `value` cuando deja de cambiar durante `delayMs`.
 * Expone el estado de la operación (`idle | saving | saved | error`) y el
 * último error para que la UI muestre feedback sin parpadeos.
 */
export function useAutosave<T>({
  value,
  onSave,
  delayMs = 5000,
  disabled = false,
}: UseAutosaveOptions<T>): {
  status: AutosaveStatus;
  error: string | null;
  lastSavedAt: Date | null;
} {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavedValueRef = useRef<T>(value);
  const firstRunRef = useRef(true);

  useEffect(() => {
    if (disabled) return;
    // En el primer render solo registramos el baseline — no se guarda nada.
    if (firstRunRef.current) {
      firstRunRef.current = false;
      lastSavedValueRef.current = value;
      return;
    }
    if (value === lastSavedValueRef.current) return;

    const timer = window.setTimeout(async () => {
      setStatus("saving");
      setError(null);
      try {
        await onSave(value);
        lastSavedValueRef.current = value;
        setStatus("saved");
        setLastSavedAt(new Date());
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [value, onSave, delayMs, disabled]);

  return { status, error, lastSavedAt };
}
