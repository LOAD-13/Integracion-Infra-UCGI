import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  listClients,
  type Client,
  type ListParams,
  type PageResponse,
} from "@/api/clients";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 20;

type FilterKey = "all" | "active" | "mine";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "mine", label: "Asignados a mí" },
];

export function ClientsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQ = searchParams.get("q") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "0");
  const initialFilter: FilterKey =
    searchParams.get("assignedToMe") === "true" ? "mine" : "all";

  const [searchInput, setSearchInput] = useState(initialQ);
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const [page, setPage] = useState<PageResponse<Client> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (filter === "mine") params.assignedToMe = "true";
    if (pageNumber > 0) params.page = String(pageNumber);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, filter, pageNumber, setSearchParams]);

  useEffect(() => {
    setPageNumber(0);
  }, [debouncedSearch, filter]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: ListParams = {
      page: pageNumber,
      size: PAGE_SIZE,
      q: debouncedSearch.trim() || undefined,
    };
    if (filter === "mine") params.assignedToMe = true;
    listClients(session.token, params)
      .then((data) => { if (!cancelled) setPage(data); })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error al listar clientes");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, pageNumber, debouncedSearch, filter]);

  return (
    <div className="flex flex-col gap-4 animate-df-fade">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 flex-1 min-w-[240px] items-center gap-2 rounded-[11px] border border-df-border bg-df-surface px-3.5">
          <Search className="h-4 w-4 text-df-text-dim" aria-hidden />
          <input
            type="search"
            placeholder="Buscar por nombre, número o email…"
            autoComplete="off"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar clientes"
            data-testid="client-search"
            className="flex-1 border-0 bg-transparent text-[13.5px] text-df-text outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className="h-10 whitespace-nowrap rounded-[10px] px-3.5 text-[13px] font-semibold"
                style={
                  active
                    ? { border: "1px solid hsl(var(--df-navy))", background: "hsl(var(--df-navy) / 0.08)", color: "hsl(var(--df-navy))" }
                    : { border: "1px solid hsl(var(--df-border))", background: "hsl(var(--df-surface))", color: "hsl(var(--df-text-muted))" }
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <Link
          to="/clients/new"
          className="flex h-10 items-center gap-1.5 rounded-[10px] border-0 bg-df-navy px-4 text-[13.5px] font-bold text-white hover:brightness-110"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo cliente
        </Link>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
        <div
          className="grid gap-2 border-b border-df-border px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-df-text-dim"
          style={{ gridTemplateColumns: "2.2fr 1.5fr 1.6fr 1fr 110px" }}
        >
          <span>Cliente</span>
          <span>Teléfono</span>
          <span>Etiquetas</span>
          <span>Estado</span>
          <span className="text-right">Últ. contacto</span>
        </div>

        {error && (
          <p role="alert" className="border-b border-df-border px-5 py-3 text-sm" style={{ color: "hsl(var(--df-hang))" }}>
            {error}
          </p>
        )}

        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="grid gap-2 border-b border-df-border px-5 py-3.5"
              style={{ gridTemplateColumns: "2.2fr 1.5fr 1.6fr 1fr 110px" }}
            >
              <div className="flex items-center gap-3">
                <div className="df-skel h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <div className="df-skel mb-1.5 h-3 w-3/5" />
                  <div className="df-skel h-2.5 w-4/5" />
                </div>
              </div>
              <div className="df-skel h-3 w-3/4 self-center" />
              <div className="df-skel h-4 w-1/2 self-center rounded-md" />
              <div className="df-skel h-3 w-1/2 self-center" />
              <div className="df-skel h-3 w-3/4 justify-self-end self-center" />
            </div>
          ))}

        {!loading && page?.content.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "hsl(var(--df-surface-2))", color: "hsl(var(--df-text-dim))" }}
            >
              <Search className="h-7 w-7" />
            </span>
            <div className="ff-display text-[15px] font-bold text-df-text">Sin resultados</div>
            <div className="max-w-[320px] text-[13px] text-df-text-muted">
              {debouncedSearch
                ? `No encontramos clientes para "${debouncedSearch}".`
                : "Todavía no hay clientes en cartera."}
            </div>
          </div>
        )}

        {!loading &&
          page?.content.map((client) => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              className="grid gap-2 border-b border-df-border px-5 py-3 transition-colors hover:bg-df-surface-2"
              style={{ gridTemplateColumns: "2.2fr 1.5fr 1.6fr 1fr 110px", alignItems: "center" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12.5px] font-bold text-white"
                  style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
                  aria-hidden
                >
                  {initials(client.name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-bold text-df-text">{client.name}</div>
                  {client.email && (
                    <div className="truncate text-[11.5px] text-df-text-dim">{client.email}</div>
                  )}
                </div>
              </div>
              <span className="ff-mono text-[12.5px] text-df-text-muted">{client.phone}</span>
              <div className="flex flex-wrap gap-1">
                {client.tags.slice(0, 3).map((t) => (
                  <span
                    key={t.id}
                    className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: t.colorBg, color: t.colorText }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
              <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-df-text-muted">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: "hsl(var(--df-st-available))" }}
                />
                Activo
              </span>
              <span className="text-right text-[12px] text-df-text-dim">
                {client.updatedAt ? new Date(client.updatedAt).toLocaleDateString() : "—"}
              </span>
            </Link>
          ))}
      </div>

      {page && page.totalPages > 1 && (
        <div className="flex items-center justify-between text-[12.5px] text-df-text-dim">
          <span>
            Mostrando <b className="text-df-text-muted">{page.content.length}</b> de {page.totalElements} clientes
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.max(0, p - 1))}
              disabled={page.first || loading}
              className="h-8 rounded-[8px] border border-df-border bg-df-surface px-3 text-[12.5px] text-df-text-muted disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="ff-mono flex h-8 items-center px-3 text-[12.5px]">
              Página {page.number + 1} de {page.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPageNumber((p) => p + 1)}
              disabled={page.last || loading}
              className="h-8 rounded-[8px] border border-df-border bg-df-surface px-3 text-[12.5px] text-df-text-muted disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
