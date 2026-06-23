import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  getAgentStatus,
  setAgentStatus as apiSetStatus,
  type AgentStatus,
  type AgentStatusInfo,
} from "@/api/agentStatus";
import { useAuth } from "@/auth/useAuth";
import { useToast } from "@/components/toast/useToast";
import { cn } from "@/lib/utils";

const STATUS_DEFS: Record<AgentStatus, { label: string; color: string }> = {
  AVAILABLE: { label: "Disponible", color: "hsl(var(--df-st-available))" },
  BREAK:     { label: "En descanso", color: "hsl(var(--df-st-break))" },
  BUSY:      { label: "Ocupado", color: "hsl(var(--df-st-busy))" },
  DND:       { label: "No molestar", color: "hsl(var(--df-st-dnd))" },
  OFFLINE:   { label: "Desconectado", color: "hsl(var(--df-st-offline))" },
};

interface AgentStatusSelectorProps {
  collapsed: boolean;
}

export function AgentStatusSelector({ collapsed }: AgentStatusSelectorProps) {
  const { session } = useAuth();
  const { push } = useToast();
  const [info, setInfo] = useState<AgentStatusInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState("00:00");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Carga inicial.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getAgentStatus(session.token).then((r) => {
      if (!cancelled) setInfo(r);
    }).catch(() => {
      // backend no disponible aun -> nos quedamos en estado UI conocido.
    });
    return () => { cancelled = true; };
  }, [session]);

  // Contador de tiempo en el estado.
  useEffect(() => {
    if (!info) return;
    const since = new Date(info.since).getTime();
    const update = () => {
      const sec = Math.max(0, Math.floor((Date.now() - since) / 1000));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      setElapsed(
        h > 0
          ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [info]);

  // Click outside cierra.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const current = info?.status ?? "OFFLINE";
  const def = STATUS_DEFS[current];

  async function handleSelect(next: AgentStatus) {
    if (!session) return;
    try {
      const updated = await apiSetStatus(session.token, next);
      setInfo(updated);
      push({ title: "Estado cambiado", desc: STATUS_DEFS[next].label, kind: "info" });
    } catch {
      push({ title: "No se pudo cambiar el estado", kind: "warn" });
    } finally {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left hover:bg-white/[0.09]"
      >
        <span
          className={cn(
            "inline-block h-[11px] w-[11px] flex-none rounded-full",
            current === "AVAILABLE" && "animate-df-pulse",
          )}
          style={{ background: def.color, boxShadow: `0 0 0 3px ${def.color}40` }}
        />
        {!collapsed && (
          <span className="flex flex-1 flex-col overflow-hidden leading-tight">
            <span className="text-[13px] font-bold text-white">{def.label}</span>
            <span className="ff-mono text-[11px] text-df-rail-text">{def.label} · {elapsed}</span>
          </span>
        )}
        {!collapsed && <ChevronDown className="h-[15px] w-[15px] text-df-rail-text" />}
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[238px] animate-df-in rounded-[13px] border border-df-border-strong bg-df-surface p-2 shadow-[0_14px_40px_rgba(13,37,66,.16)]">
          {(Object.keys(STATUS_DEFS) as AgentStatus[]).map((key) => {
            const opt = STATUS_DEFS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => void handleSelect(key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-df-text hover:bg-df-surface-2",
                  key === current && "bg-df-surface-2",
                )}
              >
                <span
                  className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                  style={{ background: opt.color }}
                />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
