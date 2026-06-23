import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, PhoneCall, PhoneMissed, RefreshCw, TrendingUp } from "lucide-react";
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
import { fetchAgentMetrics, type AgentMetrics } from "@/api/metrics";

interface MetricsPageProps {
  autoRefreshMs?: number;
}

export function MetricsPage({ autoRefreshMs = 60000 }: MetricsPageProps = {}) {
  const { session } = useAuth();
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const intervalRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgentMetrics(session.token);
      setMetrics(data);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar métricas");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
    if (autoRefreshMs > 0) {
      intervalRef.current = window.setInterval(load, autoRefreshMs);
      return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
    }
    return undefined;
  }, [load, autoRefreshMs]);

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

      <section
        aria-label="Indicadores clave"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
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
              <div
                className="ff-display text-[30px] font-bold leading-none tabular-nums tracking-tight text-df-text"
                data-testid={`kpi-${k.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
              >
                {k.value}
              </div>
              {k.delta && (
                <div className="text-[12px] font-semibold" style={{ color: k.deltaColor }}>
                  {k.delta}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface p-5 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
        <div className="ff-display mb-1 text-[14.5px] font-bold text-df-text">Llamadas por hora</div>
        <div className="mb-4 text-[12px] text-df-text-dim">Total vs. atendidas — buckets horarios del día.</div>
        <div
          data-testid="metrics-chart"
          className="h-64 w-full"
          role="img"
          aria-label="Gráfico de líneas con llamadas totales y atendidas por hora"
        >
          {metrics && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.byHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
