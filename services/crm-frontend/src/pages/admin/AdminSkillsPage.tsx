import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createSkill,
  deleteSkill,
  listSkills,
  updateSkill,
  type Skill,
  type SkillPayload,
  type SkillStrategy,
} from "@/api/skills";
import { useToast } from "@/components/toast/useToast";

const STRATEGY_LABEL: Record<SkillStrategy, string> = {
  ALL_TO_FIRST: "Todos a 1°",
  ROUND_ROBIN: "Round-robin",
  LONGEST_IDLE: "Longest idle",
  LEAST_BUSY: "Least busy",
};

export function AdminSkillsPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try { setSkills(await listSkills(session.token)); } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(payload: SkillPayload, id?: number) {
    if (!session) return;
    try {
      if (id) await updateSkill(session.token, id, payload);
      else await createSkill(session.token, payload);
      push({ title: id ? "Skill actualizado" : "Skill creado", kind: "ok" });
      setEditing(null);
      setCreating(false);
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleDelete(s: Skill) {
    if (!session) return;
    if (!window.confirm(`¿Eliminar skill "${s.name}" con ${s.agentCount} agentes?`)) return;
    try {
      await deleteSkill(session.token, s.id);
      push({ title: "Skill eliminado", kind: "ok" });
      await load();
    } catch (e) {
      push({ title: "No se pudo eliminar", desc: (e as Error).message, kind: "warn" });
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-df-fade">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-df-text-muted">
          {loading ? "Cargando…" : `${skills.length} skills configurados`}
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 items-center gap-1.5 rounded-[10px] border-0 bg-df-navy px-4 text-[13.5px] font-bold text-white hover:brightness-110"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva skill
        </button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
        <div
          className="grid gap-2 border-b border-df-border px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-df-text-dim"
          style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 100px 110px" }}
        >
          <span>Nombre</span>
          <span>Estrategia</span>
          <span>Espera máx.</span>
          <span>Agentes</span>
          <span className="text-right">Acciones</span>
        </div>
        {!loading && skills.map((s) => (
          <div
            key={s.id}
            className="grid gap-2 border-b border-df-border px-5 py-3"
            style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 100px 110px", alignItems: "center" }}
          >
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-bold text-df-text">{s.name}</div>
              {s.description && <div className="truncate text-[11.5px] text-df-text-dim">{s.description}</div>}
            </div>
            <span
              className="self-center rounded-md px-2 py-0.5 text-[11.5px] font-bold w-fit"
              style={{ background: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" }}
            >
              {STRATEGY_LABEL[s.strategy]}
            </span>
            <span className="ff-mono text-[12.5px] text-df-text-muted">{s.maxWaitSeconds}s</span>
            <span className="ff-mono text-[13px] font-semibold text-df-text">{s.agentCount}</span>
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => setEditing(s)} aria-label={`Editar ${s.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border text-df-text-muted hover:text-df-text">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => handleDelete(s)} aria-label={`Eliminar ${s.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border text-df-text-muted hover:text-df-hang">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <SkillDialog
          initial={editing ?? undefined}
          skills={skills}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(p) => handleSave(p, editing?.id)}
        />
      )}
    </div>
  );
}

function SkillDialog({
  initial,
  skills,
  onClose,
  onSave,
}: {
  initial?: Skill;
  skills: Skill[];
  onClose: () => void;
  onSave: (p: SkillPayload) => Promise<void> | void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [strategy, setStrategy] = useState<SkillStrategy>(initial?.strategy ?? "ROUND_ROBIN");
  const [maxWaitSeconds, setMaxWait] = useState(initial?.maxWaitSeconds ?? 120);
  const [overflowSkillId, setOverflow] = useState<number | null>(initial?.overflowSkillId ?? null);

  return (
    <div className="fixed inset-0 z-[50] flex animate-df-fade items-center justify-center p-4" style={{ background: "rgba(8,18,32,.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[500px] max-w-[92vw] animate-df-in overflow-hidden rounded-[15px] border border-df-border-strong bg-df-surface shadow-[0_14px_40px_rgba(13,37,66,.16)]">
        <div className="border-b border-df-border px-5 py-4">
          <div className="ff-display text-[16px] font-bold text-df-text">{initial ? "Editar skill" : "Nueva skill"}</div>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
          <Lbl label="Nombre">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Soporte técnico"
              className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
          </Lbl>
          <Lbl label="Descripción">
            <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 py-2 text-[14px] outline-none focus:border-df-brand" />
          </Lbl>
          <Lbl label="Estrategia">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(STRATEGY_LABEL) as SkillStrategy[]).map((s) => (
                <button key={s} type="button" onClick={() => setStrategy(s)}
                  className="h-10 rounded-[10px] border text-[12.5px] font-semibold"
                  style={strategy === s
                    ? { border: "1px solid hsl(var(--df-navy))", background: "hsl(var(--df-navy) / 0.08)", color: "hsl(var(--df-navy))" }
                    : { border: "1px solid hsl(var(--df-border))", background: "hsl(var(--df-surface-2))", color: "hsl(var(--df-text-muted))" }}>
                  {STRATEGY_LABEL[s]}
                </button>
              ))}
            </div>
          </Lbl>
          <div className="grid grid-cols-2 gap-3">
            <Lbl label="Espera máx. (s)">
              <input type="number" min={10} value={maxWaitSeconds} onChange={(e) => setMaxWait(parseInt(e.target.value, 10) || 0)}
                className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
            </Lbl>
            <Lbl label="Overflow skill">
              <select value={overflowSkillId ?? ""} onChange={(e) => setOverflow(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand">
                <option value="">Sin overflow</option>
                {skills.filter((s) => s.id !== initial?.id).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Lbl>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-df-border px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-[10px] border border-df-border bg-transparent px-4 text-[13px] font-semibold text-df-text-muted">Cancelar</button>
          <button type="button" disabled={!name.trim()} onClick={() => void onSave({ name, description: description || null, strategy, maxWaitSeconds, overflowSkillId })}
            className="h-10 rounded-[10px] border-0 bg-df-navy px-4 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-60">
            {initial ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Lbl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-bold text-df-text-muted">{label}</label>
      {children}
    </div>
  );
}
