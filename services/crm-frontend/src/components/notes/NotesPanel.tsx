import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createNote,
  listNotes,
  updateNote,
  type Note,
} from "@/api/notes";
import { useAutosave, type AutosaveStatus } from "@/hooks/useAutosave";
import { Textarea } from "@/components/ui/textarea";

interface NotesPanelProps {
  clientId: number;
  /** Override del delay del autosave (útil para tests). */
  autosaveDelayMs?: number;
}

export function NotesPanel({
  clientId,
  autosaveDelayMs = 5000,
}: NotesPanelProps) {
  const { session } = useAuth();
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoaded(false);
    listNotes(session.token, clientId)
      .then((notes) => {
        if (cancelled) return;
        const latest = notes[0] ?? null;
        setActiveNote(latest);
        setDraft(latest?.body ?? "");
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(
            err instanceof Error ? err.message : "No se pudieron cargar las notas",
          );
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session, clientId]);

  const handleSave = useCallback(
    async (value: string) => {
      if (!session) throw new Error("Sesión no disponible");
      const trimmed = value.trim();
      if (!trimmed) return; // No persistimos notas vacías.
      if (activeNote) {
        const updated = await updateNote(session.token, activeNote.id, trimmed);
        setActiveNote(updated);
      } else {
        const created = await createNote(session.token, {
          clientId,
          body: trimmed,
        });
        setActiveNote(created);
      }
    },
    [session, activeNote, clientId],
  );

  const { status, error, lastSavedAt } = useAutosave<string>({
    value: draft,
    onSave: handleSave,
    delayMs: autosaveDelayMs,
    disabled: !loaded || !session,
  });

  return (
    <div className="space-y-3" data-testid="notes-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Notas del cliente</h3>
          <p className="text-xs text-muted-foreground">
            Autosave cada {Math.round(autosaveDelayMs / 1000)}s. Se guarda mientras
            escribís — no hace falta tocar botones.
          </p>
        </div>
        <StatusBadge status={status} lastSavedAt={lastSavedAt} />
      </div>
      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Textarea
        rows={6}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Anotá los puntos importantes de la llamada (autosave activo)"
        disabled={!loaded}
        aria-label="Notas del cliente"
        data-testid="notes-textarea"
      />
    </div>
  );
}

function StatusBadge({
  status,
  lastSavedAt,
}: {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
}) {
  if (status === "saving") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        data-testid="autosave-status"
      >
        <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
        Guardando…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"
        data-testid="autosave-status"
      >
        <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
        Guardado
        {lastSavedAt && (
          <span className="text-muted-foreground">
            · {lastSavedAt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-destructive"
        data-testid="autosave-status"
      >
        <TriangleAlert aria-hidden="true" className="h-3 w-3" />
        Error al guardar
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      data-testid="autosave-status"
    >
      <CircleDashed aria-hidden="true" className="h-3 w-3" />
      Sin cambios
    </span>
  );
}
