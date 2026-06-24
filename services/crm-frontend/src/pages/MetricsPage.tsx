import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Clock, PhoneCall, PhoneMissed, RefreshCw, TrendingUp, Users, X } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/auth/useAuth";
import {
  fetchAdminMetrics,
  fetchAgentMetrics,
  fetchAgentMetricsByUsername,
  type AdminMetrics,
  type AgentMetrics,
  type HourlyBucket,
} from "@/api/metrics";

interface MetricsPageProps {
  autoRefreshMs?: number;
}

export function MetricsPage({ autoRefreshMs = 60000 }: MetricsPageProps = {}) {
  const { session } = useAuth();
  const isAdmin = session?.role === "ADMIN";
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics | null>(null);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  // username del agente seleccionado en el ranking (filtra los KPIs admin).
  const [focusUsername, setFocusUsername] = useState<string | null>(null);
  // métricas del agente seleccionado (para chart byHour). Cargadas on-demand.
  const [focusedAgentDetail, setFocusedAgentDetail] = useState<AgentMetrics | null>(null);
  const intervalRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const data = await fetchAdminMetrics(session.token);
        setAdminMetrics(data);
      } else {
        const data = await fetchAgentMetrics(session.token);
        setAgentMetrics(data);
      }
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar métricas");
    } finally {
      setLoading(false);
    }
  }, [session, isAdmin]);

  useEffect(() => {
    load();
    if (autoRefreshMs > 0) {
      intervalRef.current = window.setInterval(load, autoRefreshMs);
      return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
    }
    return undefined;
  }, [load, autoRefreshMs]);

  const focusedAgent = useMemo(() => {
    if (!focusUsername || !adminMetrics) return null;
    return adminMetrics.topAgents.find((a) => a.username === focusUsername) ?? null;
  }, [focusUsername, adminMetrics]);

  // Cuando hay focus, traemos el detalle del agente (incluye byHour real).
  useEffect(() => {
    if (!session || !isAdmin || !focusUsername) {
      setFocusedAgentDetail(null);
      return;
    }
    let cancelled = false;
    fetchAgentMetricsByUsername(session.token, focusUsername)
      .then((d) => { if (!cancelled) setFocusedAgentDetail(d); })
      .catch(() => { if (!cancelled) setFocusedAgentDetail(null); });
    return () => { cancelled = true; };
  }, [session, isAdmin, focusUsername]);

  // Cuando hay foco, sintetizamos una vista "como si" fuera del agente para
  // los KPI cards + breakdown + chart de horas. byHour del agente solo se
  // calcula de forma aproximada (no tenemos el detalle, así que dejamos el
  // global como referencia y ocultamos las series de barras si hace falta).
  const focusedAdminMetrics: AdminMetrics | null = focusedAgent && adminMetrics
    ? {
        ...adminMetrics,
        totalCalls: focusedAgent.totalCalls,
        answeredCalls: focusedAgent.answeredCalls,
        missedCalls: focusedAgent.totalCalls - focusedAgent.answeredCalls,
        averageHandleSeconds: focusedAgent.averageHandleSeconds,
        answerRate: focusedAgent.totalCalls > 0
          ? focusedAgent.answeredCalls / focusedAgent.totalCalls
          : 0,
      }
    : adminMetrics;

  // byHour: si hay focus en agente, usamos el detalle del backend; sino el global.
  const byHour: HourlyBucket[] = !isAdmin
    ? agentMetrics?.byHour ?? []
    : focusedAgentDetail?.byHour ?? adminMetrics?.byHour ?? [];

  return (
    <div className="flex flex-col gap-5 animate-df-fade">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-df-text-muted">
          {lastUpdatedAt && <>Actualizado {lastUpdatedAt.toLocaleTimeString("es-PE")}</>}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          data-testid="refresh-metrics"
          className="flex h-10 items-center gap-1.5 rounded-[10px] border border-df-border bg-df-surface px-3.5 text-[13px] font-semibold text-df-text-muted hover:border-df-border-strong hover:text-df-text disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refrescar
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "hsl(var(--df-hang))" }}>
          {error}
        </p>
      )}

      {isAdmin && focusedAgent && (
        <div className="flex animate-df-in items-center gap-3 rounded-xl border border-df-brand/40 bg-df-brand-soft px-4 py-2.5 transition-all">
          <span className="text-[13px] font-semibold text-df-brand-ink">
            Filtrando por <b>{focusedAgent.fullName}</b> · {focusedAgent.username}
          </span>
          <button
            type="button"
            onClick={() => setFocusUsername(null)}
            className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-df-brand-ink hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            Volver a global
          </button>
        </div>
      )}

      {isAdmin ? (
        <AdminKpis metrics={focusedAdminMetrics} />
      ) : (
        <AgentKpis metrics={agentMetrics} />
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface p-5 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
          <div className="ff-display mb-1 text-[14.5px] font-bold text-df-text">
            {isAdmin ? "Llamadas globales por hora" : "Llamadas por hora"}
          </div>
          <div className="mb-4 text-[12px] text-df-text-dim">Total vs. atendidas — buckets horarios del día.</div>
          <div
            data-testid="metrics-chart"
            className="h-64 w-full"
            role="img"
            aria-label="Gráfico de líneas con llamadas totales y atendidas por hora"
          >
            {byHour.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--df-border))" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} stroke="hsl(var(--df-text-dim))" />
                  <YAxis allowDecimals={false} stroke="hsl(var(--df-text-dim))" />
                  <Tooltip
                    labelFormatter={(label) => `Hora ${label}:00`}
                    formatter={(value, name) => [String(value), name === "total" ? "Totales" : "Atendidas"]}
                  />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--df-brand))" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="answered" stroke="hsl(var(--df-call))" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {!isAdmin && agentMetrics && (
          <OutcomeBreakdown metrics={agentMetrics} />
        )}
        {isAdmin && focusedAdminMetrics && (
          <GlobalBreakdown metrics={focusedAdminMetrics} />
        )}
      </div>

      {isAdmin && adminMetrics && (
        <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
          <div className="border-b border-df-border px-5 py-4">
            <div className="ff-display text-[14.5px] font-bold text-df-text">Ranking de agentes</div>
            <div className="text-[12px] text-df-text-dim">Top 5 por volumen del día — útil para coaching.</div>
          </div>
          {adminMetrics.topAgents.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-df-text-muted">
              Sin actividad de agentes hoy.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-df-border text-[11px] font-bold uppercase tracking-wider text-df-text-dim">
                    <th className="px-5 py-3 text-left">Agente</th>
                    <th className="px-5 py-3 text-right">Llamadas</th>
                    <th className="px-5 py-3 text-right">Atendidas</th>
                    <th className="px-5 py-3 text-right">TMO</th>
                  </tr>
                </thead>
                <tbody>
                  {adminMetrics.topAgents.map((a) => {
                    const isFocus = focusUsername === a.username;
                    return (
                      <tr
                        key={a.username}
                        onClick={() => setFocusUsername(isFocus ? null : a.username)}
                        className="cursor-pointer border-b border-df-border transition-colors hover:bg-df-surface-2 last:border-0"
                        style={isFocus ? { background: "hsl(var(--df-brand) / 0.13)" } : undefined}
                        title={isFocus ? "Click para volver al global" : "Click para filtrar por este agente"}
                      >
                        <td className="px-5 py-3 text-[13px] font-semibold text-df-text">
                          {a.fullName} <span className="text-df-text-dim">· {a.username}</span>
                        </td>
                        <td className="ff-mono px-5 py-3 text-right text-[13px] text-df-text-muted">{a.totalCalls}</td>
                        <td className="ff-mono px-5 py-3 text-right text-[13px] text-df-text-muted">{a.answeredCalls}</td>
                        <td className="ff-mono px-5 py-3 text-right text-[13px] text-df-text-muted">
                          {formatDuration(a.averageHandleSeconds)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentKpis({ metrics }: { metrics: AgentMetrics | null }) {
  const kpis = [
    {
      icon: PhoneCall,
      label: "Llamadas atendidas",
      value: String(metrics?.answeredCount ?? 0),
      delta: metrics ? `Día ${metrics.date}` : "",
      deltaColor: "hsl(var(--df-text-muted))",
    },
    {
      icon: Clock,
      label: "Duración media",
      value: metrics ? formatDuration(metrics.averageDurationSeconds) : "—",
      delta: "promedio del turno",
      deltaColor: "hsl(var(--df-text-muted))",
    },
    {
      icon: TrendingUp,
      label: "Tasa de atención",
      value: metrics ? formatPercent(metrics.answerRate) : "—",
      delta: metrics && metrics.answerRate >= 0.9 ? "▲ excelente" : "",
      deltaColor: "hsl(var(--df-call))",
    },
    {
      icon: PhoneMissed,
      label: "Llamadas perdidas",
      value: String((metrics?.missedCount ?? 0) + (metrics?.failedCount ?? 0) + (metrics?.busyCount ?? 0)),
      delta: "",
      deltaColor: "hsl(var(--df-hang))",
    },
  ];
  return <KpiGrid kpis={kpis} />;
}

function AdminKpis({ metrics }: { metrics: AdminMetrics | null }) {
  const kpis = [
    {
      icon: PhoneCall,
      label: "Llamadas globales",
      value: String(metrics?.totalCalls ?? 0),
      delta: metrics ? `Día ${metrics.date}` : "",
      deltaColor: "hsl(var(--df-text-muted))",
    },
    {
      icon: TrendingUp,
      label: "Tasa global",
      value: metrics ? formatPercent(metrics.answerRate) : "—",
      delta: `${metrics?.answeredCalls ?? 0} atendidas`,
      deltaColor: "hsl(var(--df-text-muted))",
    },
    {
      icon: Users,
      label: "Agentes disponibles",
      value: `${metrics?.activeAgents ?? 0} / ${metrics?.totalAgents ?? 0}`,
      delta: "en estado AVAILABLE",
      deltaColor: "hsl(var(--df-text-muted))",
    },
    {
      icon: Activity,
      label: "TMO promedio",
      value: metrics ? formatDuration(metrics.averageHandleSeconds) : "—",
      delta: "tiempo medio operación",
      deltaColor: "hsl(var(--df-text-muted))",
    },
  ];
  return <KpiGrid kpis={kpis} />;
}

function KpiGrid({
  kpis,
}: {
  kpis: Array<{ icon: typeof PhoneCall; label: string; value: string; delta: string; deltaColor: string }>;
}) {
  return (
    <section aria-label="Indicadores clave" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.label}
            className="flex flex-col gap-2.5 rounded-[14px] border border-df-border bg-df-surface p-4 shadow-[0_1px_2px_rgba(13,37,66,.04)] transition-all duration-200"
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
            <div
              key={`val-${k.value}`}
              className="ff-display animate-df-in text-[30px] font-bold leading-none tabular-nums tracking-tight text-df-text"
              data-testid={`kpi-${k.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            >
              {k.value}
            </div>
            {k.delta && (
              <div className="text-[12px] font-semibold transition-colors" style={{ color: k.deltaColor }}>
                {k.delta}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function OutcomeBreakdown({ metrics }: { metrics: AgentMetrics }) {
  const total = metrics.totalCount || 1;
  const rows = [
    { label: "Atendidas", value: metrics.answeredCount, color: "hsl(var(--df-call))" },
    { label: "No contestó", value: metrics.missedCount, color: "hsl(var(--df-st-offline))" },
    { label: "Ocupado", value: metrics.busyCount, color: "hsl(var(--df-st-break))" },
    { label: "Falló", value: metrics.failedCount, color: "hsl(var(--df-hang))" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface p-5 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
      <div className="ff-display mb-1 text-[14.5px] font-bold text-df-text">Resultados</div>
      <div className="mb-4 text-[12px] text-df-text-dim">Distribución por outcome del día.</div>
      <div className="flex flex-col gap-3">
        {rows.map((r) => {
          const pct = Math.round((r.value / total) * 100);
          return (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold">
                <span className="text-df-text">{r.label}</span>
                <span className="ff-mono text-df-text-muted">{r.value} · {pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-df-surface-2">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GlobalBreakdown({ metrics }: { metrics: AdminMetrics }) {
  const occupancy = metrics.totalAgents > 0
    ? Math.round((metrics.activeAgents / metrics.totalAgents) * 100)
    : 0;
  const slaColor = metrics.answerRate >= 0.9
    ? "hsl(var(--df-call))"
    : metrics.answerRate >= 0.7
      ? "hsl(var(--df-st-break))"
      : "hsl(var(--df-hang))";
  return (
    <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface p-5 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
      <div className="ff-display mb-1 text-[14.5px] font-bold text-df-text">SLA y ocupación</div>
      <div className="mb-4 text-[12px] text-df-text-dim">Snapshot operacional en vivo.</div>
      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold">
            <span className="text-df-text">SLA atención</span>
            <span className="ff-mono" style={{ color: slaColor }}>
              {Math.round(metrics.answerRate * 100)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-df-surface-2">
            <div className="h-full rounded-full"
              style={{ width: `${Math.round(metrics.answerRate * 100)}%`, background: slaColor }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[12.5px] font-semibold">
            <span className="text-df-text">Agentes disponibles</span>
            <span className="ff-mono text-df-text-muted">
              {metrics.activeAgents} / {metrics.totalAgents} · {occupancy}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-df-surface-2">
            <div className="h-full rounded-full"
              style={{ width: `${occupancy}%`, background: "hsl(var(--df-brand))" }} />
          </div>
        </div>
        <div className="rounded-xl border border-df-border bg-df-surface-2 px-3 py-2">
          <div className="text-[11.5px] font-semibold uppercase tracking-wider text-df-text-dim">
            Llamadas perdidas
          </div>
          <div className="ff-display mt-1 text-[22px] font-bold text-df-text">{metrics.missedCalls}</div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return "00:00";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
