import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  FileEdit,
  Phone,
  PhoneIncoming,
  Smartphone,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { listIncomingQueue, type QueueEntry } from "@/api/queue";

const KPI_ICON: Record<string, typeof Phone> = {
  calls: Phone,
  duration: Clock,
  rate: CheckCircle2,
  queue: Users,
};

const PRIO_COLOR: Record<string, string> = {
  alta: "hsl(var(--df-hang))",
  media: "hsl(var(--df-st-break))",
  baja: "hsl(var(--df-st-offline))",
};

export function DashboardPage() {
  const { session } = useAuth();
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = () => {
      listIncomingQueue(session.token)
        .then((rows) => { if (!cancelled) setQueue(rows); })
        .catch(() => { /* silencioso */ });
    };
    tick();
    const id = window.setInterval(tick, 10000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [session]);

  const kpis = [
    { key: "calls", label: "Llamadas hoy", value: "47", delta: "▲ 12% vs ayer", deltaColor: "hsl(var(--df-call))" },
    { key: "duration", label: "Duración prom.", value: "4:38", delta: "▼ 22s vs ayer", deltaColor: "hsl(var(--df-call))" },
    { key: "rate", label: "Tasa contestación", value: "92%", delta: "▲ 3 pts", deltaColor: "hsl(var(--df-call))" },
    { key: "queue", label: "En cola ahora", value: String(queue.length), delta: "tiempo prom. 1:04", deltaColor: "hsl(var(--df-text-muted))" },
  ];

  return (
    <div className="flex flex-col gap-5 animate-df-fade">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = KPI_ICON[k.key];
          return (
            <div
              key={k.key}
              className="flex flex-col gap-2.5 rounded-[14px] border border-df-border bg-df-surface p-4 shadow-[0_1px_2px_rgba(13,37,66,.04)]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-df-text-muted">{k.label}</span>
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-[9px]"
                  style={{ background: "hsl(var(--df-navy) / 0.08)", color: "hsl(var(--df-navy))" }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div className="ff-display text-[30px] font-bold leading-none tracking-tight text-df-text">
                {k.value}
              </div>
              <div className="text-[12px] font-semibold" style={{ color: k.deltaColor }}>
                {k.delta}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Cola de llamadas entrantes" chip={`${queue.length} en espera`} chipColor="hang" live>
          {queue.length === 0 && (
            <div className="px-5 py-10 text-center text-[13px] text-df-text-muted">
              No hay llamadas en cola en este momento.
            </div>
          )}
          {queue.map((q) => (
            <div key={q.uniqueId} className="flex items-center gap-3.5 border-b border-df-border px-5 py-3.5">
              <span
                className="h-9 w-1 flex-none rounded"
                style={{ background: PRIO_COLOR[q.priority] }}
                aria-hidden
              />
              <div
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-df-border bg-df-surface-2 text-[13px] font-bold text-df-text-muted"
                aria-hidden
              >
                {q.clientName ? initials(q.clientName) : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold text-df-text">
                  {q.clientName ?? "Número desconocido"}
                </div>
                <div className="ff-mono text-[12px] text-df-text-dim">
                  {q.fromNumber} · {q.reason}
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="text-[11px] text-df-text-dim">en cola</div>
                <div className="ff-mono text-[13px] font-semibold text-df-text-muted">{q.waitTime}</div>
              </div>
              <button
                type="button"
                className="flex h-9 items-center gap-1.5 rounded-[9px] border-0 px-3.5 text-[13px] font-bold text-white hover:brightness-110"
                style={{ background: "hsl(var(--df-call))" }}
                aria-label={`Tomar llamada de ${q.clientName ?? q.fromNumber}`}
              >
                <PhoneIncoming className="h-3.5 w-3.5" aria-hidden />
                Tomar
              </button>
            </div>
          ))}
        </Card>

        <div className="flex flex-col gap-5">
          <Card title="Acciones rápidas">
            <div className="grid grid-cols-2 gap-3 p-4">
              <QuickAction icon={Smartphone} label="Marcar número" hint="Ctrl+D" />
              <QuickAction icon={Video} label="Videollamada" />
              <QuickAction icon={PhoneIncoming} label="Simular entrante" />
              <Link
                to="/clients"
                className="flex flex-col gap-2 rounded-[12px] border border-df-border bg-df-surface-2 p-3.5 text-left hover:border-df-brand hover:bg-df-brand-soft"
              >
                <Users className="h-5 w-5" style={{ color: "hsl(var(--df-navy))" }} aria-hidden />
                <span className="text-[13px] font-bold text-df-text">Buscar cliente</span>
              </Link>
            </div>
          </Card>

          <Card title="Actividad reciente">
            <RecentRow
              icon={CheckCircle2}
              tone="call"
              text="Llamada con cliente"
              time="Hace 12 min · resuelto"
              meta="04:12"
            />
            <RecentRow
              icon={FileEdit}
              tone="brand"
              text="Nota guardada"
              time="Hace 40 min"
              meta=""
            />
            <RecentRow
              icon={Video}
              tone="brand"
              text="Videollamada finalizada"
              time="Hace 1 h · venta cerrada"
              meta="12:31"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  chip,
  chipColor,
  live,
  children,
}: {
  title: string;
  chip?: string;
  chipColor?: "hang" | "brand";
  live?: boolean;
  children: React.ReactNode;
}) {
  const palette = chipColor === "hang"
    ? { bg: "hsl(var(--df-hang) / 0.11)", color: "hsl(var(--df-hang))" }
    : { bg: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" };
  return (
    <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
      <div className="flex items-center justify-between border-b border-df-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="h-4 w-1 rounded" style={{ background: "hsl(var(--df-brand))" }} aria-hidden />
          <span className="ff-display text-[15px] font-bold text-df-text">{title}</span>
          {chip && (
            <span
              className="ff-mono rounded-full px-2 py-0.5 text-[12px] font-semibold"
              style={{ background: palette.bg, color: palette.color }}
            >
              {chip}
            </span>
          )}
        </div>
        {live && (
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-df-text-muted">
            <span
              className="inline-block h-2 w-2 animate-df-pulse rounded-full"
              style={{ background: "hsl(var(--df-call))" }}
            />
            En vivo
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, hint }: { icon: typeof Phone; label: string; hint?: string }) {
  return (
    <button
      type="button"
      className="flex flex-col gap-2 rounded-[12px] border border-df-border bg-df-surface-2 p-3.5 text-left hover:border-df-brand hover:bg-df-brand-soft"
    >
      <Icon className="h-5 w-5" style={{ color: "hsl(var(--df-navy))" }} aria-hidden />
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-df-text">{label}</span>
        {hint && (
          <kbd className="ff-mono rounded border border-df-border bg-df-surface px-1.5 py-0.5 text-[10px] text-df-text-muted">
            {hint}
          </kbd>
        )}
      </span>
    </button>
  );
}

function RecentRow({
  icon: Icon,
  tone,
  text,
  time,
  meta,
}: {
  icon: typeof Phone;
  tone: "call" | "brand";
  text: string;
  time: string;
  meta: string;
}) {
  const palette = tone === "call"
    ? { bg: "hsl(var(--df-call) / 0.13)", color: "hsl(var(--df-call))" }
    : { bg: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" };
  return (
    <div className="flex items-center gap-3 border-b border-df-border px-5 py-3 last:border-0">
      <span
        className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px]"
        style={palette}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-df-text">{text}</div>
        <div className="text-[11.5px] text-df-text-dim">{time}</div>
      </div>
      {meta && <span className="ff-mono text-[12px] text-df-text-muted">{meta}</span>}
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
