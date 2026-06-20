import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  PhoneCall,
  PhoneMissed,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MetricsPageProps {
  /** Override del intervalo para tests. */
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
      return () => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
      };
    }
    return undefined;
  }, [load, autoRefreshMs]);

  return (
    <div className="container space-y-6 py-10">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/">
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
          Volver al panel
        </Link>
      </Button>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Métricas del agente
          </h1>
          <p className="text-sm text-muted-foreground">
            {metrics
              ? `Día ${metrics.date} · ${metrics.totalCount} llamadas registradas`
              : "Cargando…"}
            {lastUpdatedAt && (
              <span className="ml-2 text-xs">
                · actualizado {lastUpdatedAt.toLocaleTimeString("es-PE")}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          data-testid="refresh-metrics"
        >
          <RefreshCw
            aria-hidden="true"
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refrescar
        </Button>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <section
        aria-label="Indicadores clave"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          icon={PhoneCall}
          label="Llamadas atendidas"
          value={metrics?.answeredCount ?? 0}
          accent="text-emerald-700"
        />
        <KpiCard
          icon={Clock}
          label="Duración media"
          value={metrics ? formatDuration(metrics.averageDurationSeconds) : "—"}
        />
        <KpiCard
          icon={TrendingUp}
          label="Tasa de atención"
          value={metrics ? formatPercent(metrics.answerRate) : "—"}
        />
        <KpiCard
          icon={PhoneMissed}
          label="Llamadas perdidas"
          value={
            (metrics?.missedCount ?? 0) +
            (metrics?.failedCount ?? 0) +
            (metrics?.busyCount ?? 0)
          }
          accent="text-destructive"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Llamadas por hora</CardTitle>
          <CardDescription>
            Total vs. atendidas — buckets horarios del día.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            data-testid="metrics-chart"
            className="h-64 w-full"
            role="img"
            aria-label="Gráfico de líneas con llamadas totales y atendidas por hora"
          >
            {metrics && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={metrics.byHour}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(label) => `Hora ${label}:00`}
                    formatter={(value, name) => [
                      String(value),
                      name === "total" ? "Totales" : "Atendidas",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="answered"
                    stroke="hsl(142 70% 35%)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface KpiCardProps {
  icon: typeof PhoneCall;
  label: string;
  value: number | string;
  accent?: string;
}

function KpiCard({ icon: Icon, label, value, accent }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Icon aria-hidden="true" className="h-4 w-4" />
          {label}
        </div>
        <p
          className={`mt-2 text-3xl font-semibold tabular-nums ${accent ?? ""}`}
          data-testid={`kpi-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
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
