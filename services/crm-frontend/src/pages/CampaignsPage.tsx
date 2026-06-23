import { useCallback, useEffect, useState } from "react";
import { Megaphone, Pause, Phone, Play, Plus, Target, Workflow } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { useSip } from "@/sip/useSip";
import { useToast } from "@/components/toast/useToast";
import {
  addCampaignContact,
  createCampaign,
  getPredictiveSuggestion,
  listCampaignContacts,
  listMyCampaigns,
  nextCampaignContact,
  transitionCampaign,
  type Campaign,
  type CampaignContact,
  type CampaignType,
  type PredictiveSuggestion,
} from "@/api/campaigns";

const TYPE_META: Record<CampaignType, { label: string; icon: typeof Phone; desc: string }> = {
  MANUAL: { label: "Manual", icon: Phone, desc: "Outbound + devolución, sin BD" },
  PROGRESSIVE: { label: "Progresiva", icon: Workflow, desc: "Carga de contactos, 1 a 1" },
  PREDICTIVE: { label: "Predictiva", icon: Target, desc: "Algoritmo TMO; dispara N llamadas" },
};

export function CampaignsPage() {
  const { session } = useAuth();
  const { call } = useSip();
  const { push } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [suggestion, setSuggestion] = useState<PredictiveSuggestion | null>(null);
  const [creating, setCreating] = useState(false);
  const [manualNum, setManualNum] = useState("");

  const load = useCallback(async () => {
    if (!session) return;
    const all = await listMyCampaigns(session.token);
    setCampaigns(all);
    if (!selectedId && all.length > 0) setSelectedId(all[0]!.id);
  }, [session, selectedId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!session || !selectedId) return;
    listCampaignContacts(session.token, selectedId).then(setContacts).catch(() => setContacts([]));
    const selected = campaigns.find((c) => c.id === selectedId);
    if (selected?.type === "PREDICTIVE") {
      getPredictiveSuggestion(session.token, selectedId).then(setSuggestion).catch(() => setSuggestion(null));
    } else {
      setSuggestion(null);
    }
  }, [session, selectedId, campaigns]);

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  async function handleTransition(action: "start" | "pause" | "finish") {
    if (!session || !selected) return;
    try {
      await transitionCampaign(session.token, selected.id, action);
      push({ title: `Campaña ${action === "start" ? "iniciada" : action === "pause" ? "pausada" : "finalizada"}`, kind: "info" });
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleNext() {
    if (!session || !selected) return;
    try {
      const next = await nextCampaignContact(session.token, selected.id);
      if (!next) {
        push({ title: "No quedan contactos pendientes", kind: "info" });
        await load();
        return;
      }
      await call(next.phone);
      push({ title: "Llamando", desc: next.phone, kind: "ok" });
      if (selected.id) {
        listCampaignContacts(session.token, selected.id).then(setContacts);
      }
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleAddContact() {
    if (!session || !selected || !manualNum.trim()) return;
    try {
      await addCampaignContact(session.token, selected.id, {
        clientId: null, phone: manualNum.trim(), displayName: null, position: contacts.length + 1,
      });
      setManualNum("");
      listCampaignContacts(session.token, selected.id).then(setContacts);
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  const kpis = selected ? [
    { label: "Realizadas", value: String((selected.totalContacts ?? 0) - (selected.pendingContacts ?? 0)) },
    { label: "Conectadas", value: String(selected.answeredContacts ?? 0) },
    { label: "Pendientes", value: String(selected.pendingContacts ?? 0) },
  ] : [];

  return (
    <div className="flex flex-col gap-5 animate-df-fade">
      <div className="grid grid-cols-3 gap-3">
        {kpis.length > 0 ? kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-df-border bg-df-surface p-4 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
            <div className="text-[12.5px] font-semibold text-df-text-muted">{k.label}</div>
            <div className="ff-display mt-1 text-[28px] font-bold text-df-text">{k.value}</div>
          </div>
        )) : (
          <div className="col-span-3 rounded-2xl border border-df-border bg-df-surface px-5 py-4 text-[13px] text-df-text-muted">
            No tenés campañas. Creá una para empezar.
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {campaigns.map((c) => {
          const Icon = TYPE_META[c.type].icon;
          const active = c.id === selectedId;
          return (
            <button key={c.id} type="button" onClick={() => setSelectedId(c.id)}
              className="flex items-center gap-2 rounded-[11px] border px-3.5 py-2 text-[13px] font-semibold"
              style={active
                ? { border: "1px solid hsl(var(--df-brand))", background: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" }
                : { border: "1px solid hsl(var(--df-border))", background: "hsl(var(--df-surface))", color: "hsl(var(--df-text-muted))" }}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {c.name}
            </button>
          );
        })}
        <button type="button" onClick={() => setCreating(true)}
          className="ml-auto flex h-10 items-center gap-1.5 rounded-[10px] border-0 bg-df-navy px-4 text-[13.5px] font-bold text-white hover:brightness-110">
          <Plus className="h-4 w-4" aria-hidden />
          Nueva campaña
        </button>
      </div>

      {selected && (
        <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
          <div className="flex items-center gap-3 border-b border-df-border px-5 py-4">
            <span className="h-4 w-1 rounded" style={{ background: "hsl(var(--df-brand))" }} />
            <div className="flex-1">
              <div className="ff-display text-[15px] font-bold text-df-text">{selected.name}</div>
              <div className="text-[11.5px] text-df-text-dim">{TYPE_META[selected.type].desc}</div>
            </div>
            <span className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold" style={{
              background: selected.status === "RUNNING" ? "hsl(var(--df-call) / 0.13)" : "hsl(var(--df-surface-3))",
              color: selected.status === "RUNNING" ? "hsl(var(--df-call))" : "hsl(var(--df-text-muted))",
            }}>
              {selected.status}
            </span>
            <CampaignControls status={selected.status} onTransition={handleTransition} />
          </div>

          {selected.type === "MANUAL" && (
            <div className="flex flex-col gap-3 p-5">
              <div className="text-[13px] text-df-text-muted">Marcador manual: ingresá el número y llamá.</div>
              <div className="flex gap-2">
                <input value={manualNum} onChange={(e) => setManualNum(e.target.value)} placeholder="+54 9 11 ..."
                  className="ff-mono h-10 flex-1 rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
                <button type="button" disabled={!manualNum.trim()} onClick={() => { void call(manualNum.trim()); push({ title: "Llamando", desc: manualNum, kind: "ok" }); }}
                  className="flex h-10 items-center gap-1.5 rounded-[10px] border-0 bg-df-call px-4 text-[13.5px] font-bold text-white hover:brightness-110 disabled:opacity-60"
                  style={{ background: "hsl(var(--df-call))" }}>
                  <Phone className="h-4 w-4" aria-hidden />
                  Llamar
                </button>
              </div>
            </div>
          )}

          {selected.type !== "MANUAL" && (
            <div className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <input value={manualNum} onChange={(e) => setManualNum(e.target.value)} placeholder="Agregar contacto: número"
                  className="ff-mono h-10 flex-1 rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
                <button type="button" disabled={!manualNum.trim()} onClick={() => void handleAddContact()}
                  className="flex h-10 items-center gap-1.5 rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[13px] font-semibold text-df-text-muted hover:text-df-text disabled:opacity-60">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Agregar
                </button>
                <button type="button" onClick={() => void handleNext()} disabled={selected.status !== "RUNNING"}
                  className="flex h-10 items-center gap-1.5 rounded-[10px] border-0 px-4 text-[13.5px] font-bold text-white hover:brightness-110 disabled:opacity-60"
                  style={{ background: "hsl(var(--df-call))" }}>
                  <Phone className="h-4 w-4" aria-hidden />
                  Siguiente contacto
                </button>
              </div>

              {selected.type === "PREDICTIVE" && suggestion && (
                <div className="flex items-center gap-3 rounded-xl border border-df-border bg-df-surface-2 px-4 py-3">
                  <Megaphone className="h-4 w-4 text-df-brand-ink" aria-hidden />
                  <span className="text-[13px] text-df-text">
                    Algoritmo predictivo: TMO {suggestion.tmoSeconds.toFixed(1)}s · dispara {suggestion.dialNow} llamadas en simultáneo.
                  </span>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-df-border">
                <div className="grid gap-2 border-b border-df-border bg-df-surface-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-df-text-dim"
                  style={{ gridTemplateColumns: "1.4fr 1fr 1fr 80px" }}>
                  <span>Contacto</span><span>Teléfono</span><span>Status</span><span>Intentos</span>
                </div>
                {contacts.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-df-text-muted">Sin contactos cargados.</div>}
                {contacts.map((c) => (
                  <div key={c.id} className="grid gap-2 border-b border-df-border px-4 py-2.5" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 80px", alignItems: "center" }}>
                    <span className="text-[13px] font-semibold text-df-text">{c.displayName ?? "—"}</span>
                    <span className="ff-mono text-[12.5px] text-df-text-muted">{c.phone}</span>
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-bold w-fit"
                      style={{
                        background: c.status === "ANSWERED" ? "hsl(var(--df-call) / 0.13)" : c.status === "PENDING" ? "hsl(var(--df-surface-3))" : "hsl(var(--df-st-break) / 0.15)",
                        color: c.status === "ANSWERED" ? "hsl(var(--df-call))" : c.status === "PENDING" ? "hsl(var(--df-text-muted))" : "hsl(var(--df-st-break))",
                      }}>
                      {c.status}
                    </span>
                    <span className="ff-mono text-[12.5px] text-df-text-muted">{c.attempts}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {creating && <CreateDialog onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} />}
    </div>
  );
}

function CampaignControls({ status, onTransition }: { status: Campaign["status"]; onTransition: (a: "start" | "pause" | "finish") => void }) {
  if (status === "FINISHED") return null;
  return (
    <div className="flex gap-2">
      {status !== "RUNNING" && (
        <button type="button" onClick={() => onTransition("start")}
          className="flex h-9 items-center gap-1.5 rounded-md border-0 px-3 text-[12.5px] font-bold text-white hover:brightness-110"
          style={{ background: "hsl(var(--df-call))" }}>
          <Play className="h-3.5 w-3.5" aria-hidden />
          Iniciar
        </button>
      )}
      {status === "RUNNING" && (
        <button type="button" onClick={() => onTransition("pause")}
          className="flex h-9 items-center gap-1.5 rounded-md border border-df-border bg-df-surface-2 px-3 text-[12.5px] font-semibold text-df-text-muted hover:text-df-text">
          <Pause className="h-3.5 w-3.5" aria-hidden />
          Pausar
        </button>
      )}
      <button type="button" onClick={() => onTransition("finish")}
        className="h-9 rounded-md border border-df-border bg-df-surface-2 px-3 text-[12.5px] font-semibold text-df-text-muted hover:text-df-hang">
        Finalizar
      </button>
    </div>
  );
}

function CreateDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { session } = useAuth();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("MANUAL");
  const [callerId, setCallerId] = useState("");

  async function handleCreate() {
    if (!session) return;
    try {
      await createCampaign(session.token, {
        name, type, skillId: null, pacingFactor: 1, maxConcurrent: 1, callerId: callerId || null,
      });
      push({ title: "Campaña creada", kind: "ok" });
      onSaved();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  return (
    <div className="fixed inset-0 z-[50] flex animate-df-fade items-center justify-center p-4" style={{ background: "rgba(8,18,32,.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[520px] max-w-[92vw] animate-df-in overflow-hidden rounded-[15px] border border-df-border-strong bg-df-surface shadow-[0_14px_40px_rgba(13,37,66,.16)]">
        <div className="border-b border-df-border px-5 py-4">
          <div className="ff-display text-[16px] font-bold text-df-text">Nueva campaña</div>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-df-text-muted">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Recuperación octubre"
              className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-df-text-muted">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as CampaignType[]).map((t) => {
                const m = TYPE_META[t];
                const Icon = m.icon;
                const active = t === type;
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className="flex flex-col items-start gap-1.5 rounded-[11px] border p-3 text-left"
                    style={active
                      ? { border: "1px solid hsl(var(--df-brand))", background: "hsl(var(--df-brand) / 0.13)" }
                      : { border: "1px solid hsl(var(--df-border))", background: "hsl(var(--df-surface-2))" }}>
                    <Icon className="h-4 w-4" style={{ color: "hsl(var(--df-brand-ink))" }} aria-hidden />
                    <span className="text-[13px] font-bold text-df-text">{m.label}</span>
                    <span className="text-[11px] text-df-text-muted">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-df-text-muted">Caller ID (opcional)</label>
            <input value={callerId} onChange={(e) => setCallerId(e.target.value)} placeholder="+54 9 11 ..."
              className="ff-mono h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-df-border px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-[10px] border border-df-border bg-transparent px-4 text-[13px] font-semibold text-df-text-muted">Cancelar</button>
          <button type="button" disabled={!name.trim()} onClick={() => void handleCreate()}
            className="h-10 rounded-[10px] border-0 bg-df-navy px-4 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-60">Crear</button>
        </div>
      </div>
    </div>
  );
}
