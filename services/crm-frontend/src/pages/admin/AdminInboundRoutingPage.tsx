import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createInboundRoute,
  deleteInboundRoute,
  listInboundRoutes,
  updateInboundRoute,
  type FallbackAction,
  type InboundRoute,
  type InboundRoutePayload,
  type ScheduleKind,
} from "@/api/inboundRoutes";
import { listSkills, type Skill } from "@/api/skills";
import { useToast } from "@/components/toast/useToast";

const SCHED_LABEL: Record<ScheduleKind, string> = {
  ALWAYS: "Siempre",
  BUSINESS: "Lun-Vie 9-18",
  CUSTOM: "Custom",
};

const FB_LABEL: Record<FallbackAction, string> = {
  VOICEMAIL: "Buzón",
  OVERFLOW_SKILL: "Overflow",
  HANGUP: "Colgar",
};

export function AdminInboundRoutingPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const [routes, setRoutes] = useState<InboundRoute[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InboundRoute | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [r, s] = await Promise.all([listInboundRoutes(session.token), listSkills(session.token)]);
      setRoutes(r); setSkills(s);
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(payload: InboundRoutePayload, id?: number) {
    if (!session) return;
    try {
      if (id) await updateInboundRoute(session.token, id, payload);
      else await createInboundRoute(session.token, payload);
      push({ title: id ? "Regla actualizada" : "Regla creada", kind: "ok" });
      setCreating(false); setEditing(null);
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleDelete(r: InboundRoute) {
    if (!session) return;
    if (!window.confirm(`¿Eliminar regla para ${r.didNumber}?`)) return;
    try {
      await deleteInboundRoute(session.token, r.id);
      push({ title: "Regla eliminada", kind: "ok" });
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  return (
    <div className="flex flex-col gap-4 animate-df-fade">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-df-text-muted">
          {loading ? "Cargando…" : `${routes.length} reglas configuradas`}
        </div>
        <button type="button" onClick={() => setCreating(true)}
          disabled={skills.length === 0}
          className="flex h-10 items-center gap-1.5 rounded-[10px] border-0 bg-df-navy px-4 text-[13.5px] font-bold text-white hover:brightness-110 disabled:opacity-60">
          <Plus className="h-4 w-4" aria-hidden />
          Nueva regla
        </button>
      </div>

      {skills.length === 0 && !loading && (
        <p className="rounded-xl border border-df-border bg-df-surface-2 px-4 py-3 text-[13px] text-df-text-muted">
          Necesitás crear al menos una skill antes de armar reglas de routing.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {!loading && routes.map((r) => {
          const skill = skills.find((s) => s.id === r.skillId);
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-df-border bg-df-surface px-5 py-3 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
              <span className="ff-mono text-[14px] font-bold text-df-text">{r.didNumber}</span>
              <span className="text-df-text-dim">→</span>
              <span className="rounded-md px-2 py-0.5 text-[12px] font-bold" style={{ background: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" }}>
                {skill?.name ?? "Skill eliminada"}
              </span>
              <span className="rounded-md bg-df-surface-2 px-2 py-0.5 text-[11.5px] text-df-text-muted">
                {SCHED_LABEL[r.scheduleKind]}
              </span>
              <span className="rounded-md bg-df-surface-2 px-2 py-0.5 text-[11.5px] text-df-text-muted">
                Plan B: {FB_LABEL[r.fallbackAction]}
              </span>
              <div className="ml-auto flex gap-1.5">
                <button type="button" onClick={() => setEditing(r)} aria-label="Editar"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border text-df-text-muted hover:text-df-text">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => handleDelete(r)} aria-label="Eliminar"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border text-df-text-muted hover:text-df-hang">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <Dialog
          initial={editing ?? undefined}
          skills={skills}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={(p) => handleSave(p, editing?.id)}
        />
      )}
    </div>
  );
}

function Dialog({
  initial, skills, onClose, onSave,
}: {
  initial?: InboundRoute;
  skills: Skill[];
  onClose: () => void;
  onSave: (p: InboundRoutePayload) => Promise<void> | void;
}) {
  const [didNumber, setDid] = useState(initial?.didNumber ?? "");
  const [skillId, setSkillId] = useState<number>(initial?.skillId ?? skills[0]!.id);
  const [scheduleKind, setSched] = useState<ScheduleKind>(initial?.scheduleKind ?? "ALWAYS");
  const [fallbackAction, setFb] = useState<FallbackAction>(initial?.fallbackAction ?? "VOICEMAIL");
  const [fallbackSkillId, setFbSkill] = useState<number | null>(initial?.fallbackSkillId ?? null);

  return (
    <div className="fixed inset-0 z-[50] flex animate-df-fade items-center justify-center p-4" style={{ background: "rgba(8,18,32,.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[500px] max-w-[92vw] animate-df-in overflow-hidden rounded-[15px] border border-df-border-strong bg-df-surface shadow-[0_14px_40px_rgba(13,37,66,.16)]">
        <div className="border-b border-df-border px-5 py-4">
          <div className="ff-display text-[16px] font-bold text-df-text">{initial ? "Editar regla" : "Nueva regla de entrada"}</div>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
          <Lbl label="DID / número de entrada">
            <input value={didNumber} onChange={(e) => setDid(e.target.value)} placeholder="+54 9 11 ..." className="ff-mono h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
          </Lbl>
          <Lbl label="Skill destino">
            <select value={skillId} onChange={(e) => setSkillId(parseInt(e.target.value, 10))} className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand">
              {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Lbl>
          <Lbl label="Horario">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(SCHED_LABEL) as ScheduleKind[]).map((k) => (
                <button key={k} type="button" onClick={() => setSched(k)}
                  className="h-10 rounded-[10px] border text-[12.5px] font-semibold"
                  style={scheduleKind === k
                    ? { border: "1px solid hsl(var(--df-navy))", background: "hsl(var(--df-navy) / 0.08)", color: "hsl(var(--df-navy))" }
                    : { border: "1px solid hsl(var(--df-border))", background: "hsl(var(--df-surface-2))", color: "hsl(var(--df-text-muted))" }}>
                  {SCHED_LABEL[k]}
                </button>
              ))}
            </div>
          </Lbl>
          <Lbl label="Plan B si no hay agentes">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FB_LABEL) as FallbackAction[]).map((k) => (
                <button key={k} type="button" onClick={() => setFb(k)}
                  className="h-10 rounded-[10px] border text-[12.5px] font-semibold"
                  style={fallbackAction === k
                    ? { border: "1px solid hsl(var(--df-navy))", background: "hsl(var(--df-navy) / 0.08)", color: "hsl(var(--df-navy))" }
                    : { border: "1px solid hsl(var(--df-border))", background: "hsl(var(--df-surface-2))", color: "hsl(var(--df-text-muted))" }}>
                  {FB_LABEL[k]}
                </button>
              ))}
            </div>
          </Lbl>
          {fallbackAction === "OVERFLOW_SKILL" && (
            <Lbl label="Skill de overflow">
              <select value={fallbackSkillId ?? ""} onChange={(e) => setFbSkill(e.target.value ? parseInt(e.target.value, 10) : null)} className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand">
                <option value="">Seleccioná…</option>
                {skills.filter((s) => s.id !== skillId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Lbl>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-df-border px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-[10px] border border-df-border bg-transparent px-4 text-[13px] font-semibold text-df-text-muted">Cancelar</button>
          <button type="button" disabled={!didNumber.trim()} onClick={() => void onSave({
              didNumber, skillId, priority: initial?.priority ?? 100, scheduleKind,
              scheduleStart: initial?.scheduleStart ?? null, scheduleEnd: initial?.scheduleEnd ?? null,
              daysMask: initial?.daysMask ?? 127, fallbackAction, fallbackSkillId,
              enabled: true,
            })}
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
