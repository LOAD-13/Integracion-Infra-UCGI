import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Smartphone,
  Users,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { listIncomingQueue, type QueueEntry } from "@/api/queue";
import { fetchAgentMetrics, type AgentMetrics } from "@/api/metrics";
import { listRecentActivity, type RecentActivity } from "@/api/recentActivity";
import { useDialer } from "@/components/softphone/dialer-context";

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

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then) || diff < 0) return "Ahora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Hace menos de 1 min";
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Hace ${d} d`;
}

export function DashboardPage() {
  const { session } = useAuth();
  const { openDialer } = useDialer();
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [recent, setRecent] = useState<RecentActivity[]>([]);

  // Poll cola entrante.
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

  // Métricas + actividad reciente cada 60s.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = () => {
      fetchAgentMetrics(session.token)
        .then((m) => { if (!cancelled) setMetrics(m); })
        .catch(() => { /* silencioso */ });
      listRecentActivity(session.token)
        .then((rows) => { if (!cancelled) setRecent(rows); })
        .catch(() => { /* silencioso */ });
    };
    tick();
    const id = window.setInterval(tick, 60000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [session]);

  const kpis = useMemo(() => {
    const total = metrics?.totalCount ?? 0;
    const avg = metrics?.averageDurationSeconds ?? 0;
    const rate = metrics?.answerRate ?? 0;
    return [
      {
        key: "calls",
        label: "Llamadas hoy",
        value: String(total),
        hint: total > 0 ? `${metrics?.answeredCount ?? 0} atendidas` : "Sin actividad del día",
        hintColor: "hsl(var(--df-text-muted))",
      },
      {
        key: "duration",
        label: "Duración prom.",
        value: formatDuration(avg),
        hint: total > 0 ? "Promedio del turno" : "Sin datos",
        hintColor: "hsl(var(--df-text-muted))",
      },
      {
        key: "rate",
        label: "Tasa contestación",
        value: total > 0 ? `${Math.round(rate * 100)}%` : "—",
        hint: `${metrics?.missedCount ?? 0} sin atender`,
        hintColor: "hsl(var(--df-text-muted))",
      },
      {
        key: "queue",
        label: "En cola ahora",
        value: String(queue.length),
        hint: queue.length === 0 ? "Sin esperas" : "Tomar llamada disponible",
        hintColor: "hsl(var(--df-text-muted))",
      },
    ];
  }, [metrics, queue.length]);

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
              <div className="text-[12px] font-semibold" style={{ color: k.hintColor }}>
                {k.hint}
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
              <button
                type="button"
                onClick={() => openDialer()}
                className="flex flex-col gap-2 rounded-[12px] border border-df-border bg-df-surface-2 p-3.5 text-left hover:border-df-brand hover:bg-df-brand-soft"
              >
                <Smartphone className="h-5 w-5" style={{ color: "hsl(var(--df-navy))" }} aria-hidden />
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-df-text">Marcar número</span>
                  <kbd className="ff-mono rounded border border-df-border bg-df-surface px-1.5 py-0.5 text-[10px] text-df-text-muted">
                    Ctrl+D
                  </kbd>
                </span>
              </button>
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
            {recent.length === 0 && (
              <div className="px-5 py-8 text-center text-[13px] text-df-text-muted">
                Sin actividad reciente.
              </div>
            )}
            {recent.map((r, i) => (
              <RecentRow
                key={`${r.occurredAt}-${i}`}
                kind={r.kind}
                title={r.title}
                subtitle={r.subtitle}
                time={formatRelative(r.occurredAt)}
                meta={r.meta}
              />
            ))}
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

function RecentRow({
  kind,
  title,
  subtitle,
  time,
  meta,
}: {
  kind: string;
  title: string;
  subtitle: string;
  time: string;
  meta: string;
}) {
  const isMissed = subtitle.includes("no contestó") || subtitle.includes("ocupado") || subtitle.includes("falló");
  const Icon = isMissed ? PhoneMissed : CheckCircle2;
  const palette = isMissed
    ? { bg: "hsl(var(--df-hang) / 0.13)", color: "hsl(var(--df-hang))" }
    : { bg: "hsl(var(--df-call) / 0.13)", color: "hsl(var(--df-call))" };
  return (
    <div className="flex items-center gap-3 border-b border-df-border px-5 py-3 last:border-0">
      <span
        className="flex h-7 w-7 flex-none items-center justify-center rounded-[9px]"
        style={palette}
        aria-label={kind}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-df-text">{title}</div>
        <div className="truncate text-[11.5px] text-df-text-dim">{subtitle} · {time}</div>
      </div>
      {meta && <span className="ff-mono text-[12px] text-df-text-muted">{meta}</span>}
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
