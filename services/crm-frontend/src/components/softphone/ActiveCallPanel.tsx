import { useEffect, useState } from "react";
import { ExternalLink, Mic, MicOff, Pause, Phone, Play, UserPlus, Video, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSip } from "@/sip/useSip";
import { useAuth } from "@/auth/useAuth";
import { findClientByPhone, type Client } from "@/api/clients";
import { useToast } from "@/components/toast/useToast";

interface ActiveCallPanelProps {
  open: boolean;
  onClose: () => void;
}

const OUTCOMES: Array<{ key: string; label: string; dot: string }> = [
  { key: "Resuelto", label: "Resuelto", dot: "hsl(var(--df-call))" },
  { key: "No contestó", label: "No contestó", dot: "hsl(var(--df-st-offline))" },
  { key: "Retornar", label: "Retornar", dot: "#7338c4" },
  { key: "Escalado", label: "Escalado", dot: "hsl(var(--df-st-break))" },
  { key: "Venta cerrada", label: "Venta cerrada", dot: "hsl(var(--df-brand))" },
];

export function ActiveCallPanel({ open, onClose }: ActiveCallPanelProps) {
  const { state, hangup, toggleMute, toggleHold } = useSip();
  const { session } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);

  // CTI: cuando hay remoteIdentity, buscamos cliente por teléfono.
  useEffect(() => {
    if (!open || !session || !state.remoteIdentity) {
      setClient(null);
      return;
    }
    let cancelled = false;
    findClientByPhone(session.token, state.remoteIdentity)
      .then((c) => { if (!cancelled) setClient(c); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [open, session, state.remoteIdentity]);

  if (!open) return null;

  const remote = state.remoteIdentity ?? "Número desconocido";
  const inActive = state.call === "connected" || state.call === "on-hold";

  return (
    <>
      <div
        className="fixed inset-0 z-[42] animate-df-fade"
        style={{ background: "rgba(8,18,32,.5)" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 right-0 top-0 z-[43] flex w-[420px] animate-df-slidein flex-col border-l border-df-border bg-df-surface shadow-[0_14px_40px_rgba(13,37,66,.16)]"
        role="dialog"
        aria-label="Panel de llamada activa"
      >
        <div className="flex items-center justify-between border-b border-df-border px-5 py-4">
          <span
            className="flex items-center gap-2 text-[11px] font-bold tracking-wide"
            style={{ color: "hsl(var(--df-call))" }}
          >
            <span
              className="inline-block h-2 w-2 animate-df-pulse rounded-full"
              style={{ background: "hsl(var(--df-call))" }}
            />
            LLAMADA EN CURSO
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-df-border bg-transparent text-df-text-muted hover:bg-df-surface-2"
            aria-label="Cerrar panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="df-scroll flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="flex items-center gap-3.5">
            <span
              className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-full text-[22px] font-bold text-white"
              style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
              aria-hidden
            >
              {initials(client?.name ?? remote)}
            </span>
            <div className="min-w-0">
              <div className="ff-display text-[19px] font-bold text-df-text">
                {client?.name ?? remote}
              </div>
              <div className="ff-mono text-[13px] text-df-text-muted">{remote}</div>
              {client && client.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {client.tags.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: t.colorBg, color: t.colorText }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {client && (
            <button
              type="button"
              onClick={() => navigate(`/clients/${client.id}`)}
              className="flex h-[42px] items-center justify-center gap-2 rounded-[11px] border border-df-border bg-df-surface-2 text-[13.5px] font-bold text-df-text hover:border-df-navy"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              Abrir ficha del cliente
            </button>
          )}

          {!client && state.remoteIdentity && (
            <button
              type="button"
              onClick={() => navigate("/clients/new")}
              className="flex h-[42px] items-center justify-center gap-2 rounded-[11px] border border-dashed text-[13.5px] font-bold hover:brightness-110"
              style={{ borderColor: "hsl(var(--df-brand))", background: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" }}
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Crear cliente con este número
            </button>
          )}

          <div>
            <div className="mb-2 text-[12.5px] font-bold text-df-text">Notas rápidas</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotá lo importante de la llamada…"
              className="w-full resize-y rounded-xl border border-df-border bg-df-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-df-text outline-none focus:border-df-brand focus:shadow-[0_0_0_3px_hsl(var(--df-brand)/0.42)]"
              style={{ minHeight: 110 }}
              aria-label="Notas de la llamada"
            />
          </div>

          <div>
            <div className="mb-2 text-[12.5px] font-bold text-df-text">Etiquetar resultado</div>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map((o) => {
                const active = outcome === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => {
                      setOutcome(o.key);
                      push({ title: "Resultado etiquetado", desc: o.label, kind: "info" });
                    }}
                    className="flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-semibold"
                    style={{
                      borderColor: active ? o.dot : "hsl(var(--df-border))",
                      background: active ? "hsl(var(--df-surface-3))" : "hsl(var(--df-surface-2))",
                      color: active ? "hsl(var(--df-text))" : "hsl(var(--df-text-muted))",
                    }}
                  >
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: o.dot }} />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-df-border px-5 py-4">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[12px] border border-df-border bg-df-surface-2 text-df-text-muted"
            aria-label={state.muted ? "Quitar silencio" : "Silenciar"}
          >
            {state.muted ? <MicOff className="h-[19px] w-[19px]" /> : <Mic className="h-[19px] w-[19px]" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleHold()}
            disabled={!inActive}
            className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[12px] border border-df-border bg-df-surface-2 text-df-text-muted disabled:opacity-50"
            aria-label="En espera"
          >
            {state.call === "on-hold" ? <Play className="h-[19px] w-[19px]" /> : <Pause className="h-[19px] w-[19px]" />}
          </button>
          <button
            type="button"
            onClick={() => void hangup()}
            className="flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[12px] border-0 text-[14px] font-bold text-white hover:brightness-110"
            style={{ background: "hsl(var(--df-hang))" }}
            aria-label="Colgar"
          >
            <Phone className="h-[18px] w-[18px] rotate-[135deg]" aria-hidden />
            Colgar
          </button>
        </div>
      </div>
    </>
  );
}

// Ignore unused Video import — reservado para futura toggle del overlay desde el panel.
void Video;

function initials(name: string): string {
  if (!name) return "?";
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  if (!clean) return "?";
  return clean.split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
