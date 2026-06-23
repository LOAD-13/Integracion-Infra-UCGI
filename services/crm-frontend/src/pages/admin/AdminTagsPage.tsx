import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createClientTag,
  deleteClientTag,
  listClientTags,
  updateClientTag,
  type ClientTag,
  type ClientTagPayload,
} from "@/api/clientTags";
import { useToast } from "@/components/toast/useToast";

const PRESETS: Array<{ bg: string; text: string }> = [
  { bg: "rgba(21,168,200,.14)", text: "#0c7c97" },
  { bg: "rgba(22,163,74,.13)", text: "#15803d" },
  { bg: "rgba(224,147,11,.15)", text: "#b9760a" },
  { bg: "rgba(226,59,84,.13)", text: "#c4243c" },
  { bg: "rgba(124,58,237,.13)", text: "#7338c4" },
  { bg: "rgba(15,48,86,.1)",   text: "#0f3056" },
];

export function AdminTagsPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const [tags, setTags] = useState<ClientTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClientTag | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      setTags(await listClientTags(session.token));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(payload: ClientTagPayload, id?: number) {
    if (!session) return;
    try {
      if (id) await updateClientTag(session.token, id, payload);
      else await createClientTag(session.token, payload);
      push({ title: id ? "Tag actualizado" : "Tag creado", kind: "ok" });
      setEditing(null);
      setCreating(false);
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleDelete(tag: ClientTag) {
    if (!session) return;
    if (!window.confirm(`¿Eliminar el tag "${tag.name}"?`)) return;
    try {
      await deleteClientTag(session.token, tag.id);
      push({ title: "Tag eliminado", kind: "ok" });
      await load();
    } catch (e) {
      push({ title: "No se pudo eliminar", desc: (e as Error).message, kind: "warn" });
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-df-fade">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-df-text-muted">
          {loading ? "Cargando…" : `${tags.length} tags · ${tags.filter((t) => t.system).length} de sistema`}
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 items-center gap-1.5 rounded-[10px] border-0 bg-df-navy px-4 text-[13.5px] font-bold text-white hover:brightness-110"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo tag
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {tags.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-2xl border border-df-border bg-df-surface p-4 shadow-[0_1px_2px_rgba(13,37,66,.04)]"
          >
            <span
              className="rounded-md px-2.5 py-1 text-[12px] font-bold"
              style={{ background: t.colorBg, color: t.colorText }}
            >
              {t.name}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(t)}
                title="Editar"
                aria-label={`Editar ${t.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border bg-transparent text-df-text-muted hover:text-df-text"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {!t.system && (
                <button
                  type="button"
                  onClick={() => handleDelete(t)}
                  title="Eliminar"
                  aria-label={`Eliminar ${t.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border bg-transparent text-df-text-muted hover:text-df-hang"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <TagDialog
          initial={editing ?? undefined}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(p) => handleSave(p, editing?.id)}
        />
      )}
    </div>
  );
}

function TagDialog({
  initial,
  onClose,
  onSave,
}: {
  initial?: ClientTag;
  onClose: () => void;
  onSave: (p: ClientTagPayload) => Promise<void> | void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [colorBg, setColorBg] = useState(initial?.colorBg ?? PRESETS[0]!.bg);
  const [colorText, setColorText] = useState(initial?.colorText ?? PRESETS[0]!.text);

  return (
    <div
      className="fixed inset-0 z-[50] flex animate-df-fade items-center justify-center p-4"
      style={{ background: "rgba(8,18,32,.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-[92vw] animate-df-in overflow-hidden rounded-[15px] border border-df-border-strong bg-df-surface shadow-[0_14px_40px_rgba(13,37,66,.16)]"
      >
        <div className="border-b border-df-border px-5 py-4">
          <div className="ff-display text-[16px] font-bold text-df-text">
            {initial ? "Editar tag" : "Nuevo tag"}
          </div>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
          <Field label="Nombre">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: VIP"
              disabled={!!initial?.system}
              className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] text-df-text outline-none focus:border-df-brand focus:shadow-[0_0_0_3px_hsl(var(--df-brand)/0.42)] disabled:opacity-60"
            />
          </Field>
          <Field label="Paleta">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.bg}
                  type="button"
                  onClick={() => { setColorBg(p.bg); setColorText(p.text); }}
                  className="rounded-md border px-3 py-1.5 text-[12px] font-bold"
                  style={{
                    background: p.bg,
                    color: p.text,
                    borderColor: colorBg === p.bg ? p.text : "transparent",
                  }}
                  aria-label={`Color ${p.text}`}
                >
                  Ejemplo
                </button>
              ))}
            </div>
          </Field>
          <div>
            <div className="text-[12px] font-bold text-df-text-muted">Preview</div>
            <div className="mt-2 flex">
              <span className="rounded-md px-2.5 py-1 text-[12px] font-bold" style={{ background: colorBg, color: colorText }}>
                {name || "Nombre del tag"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-df-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[10px] border border-df-border bg-transparent px-4 text-[13px] font-semibold text-df-text-muted hover:text-df-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onSave({ name, colorBg, colorText })}
            disabled={!name.trim()}
            className="h-10 rounded-[10px] border-0 bg-df-navy px-4 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-60"
          >
            {initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-bold text-df-text-muted">{label}</label>
      {children}
    </div>
  );
}
