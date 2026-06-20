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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  FilterPanel,
  type ClientFilters,
} from "@/components/clients/FilterPanel";

const PAGE_SIZE = 20;
const DEFAULT_FILTERS: ClientFilters = { assignedToMe: false };

export function ClientsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQ = searchParams.get("q") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "0");
  const initialFilters: ClientFilters = {
    assignedToMe: searchParams.get("assignedToMe") === "true",
  };

  const [searchInput, setSearchInput] = useState(initialQ);
  const [filters, setFilters] = useState<ClientFilters>(initialFilters);
  const [pageNumber, setPageNumber] = useState(initialPage);

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const [page, setPage] = useState<PageResponse<Client> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza URL ↔ estado (compartible).
  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
    if (filters.assignedToMe) params.assignedToMe = "true";
    if (pageNumber > 0) params.page = String(pageNumber);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, filters, pageNumber, setSearchParams]);

  // Reset a la página 0 cuando cambian search o filtros (no cuando cambia la
  // página, obvio — sino loopearía).
  useEffect(() => {
    setPageNumber(0);
  }, [debouncedSearch, filters.assignedToMe]);

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
    if (filters.assignedToMe) {
      (params as ListParams & { assignedToMe?: boolean }).assignedToMe = true;
    }
    listClients(session.token, params)
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error al listar clientes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, pageNumber, debouncedSearch, filters.assignedToMe]);

  function handleClearFilters() {
    setSearchInput("");
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <div className="container space-y-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Cartera del agente · gestiona la información que vas a usar al
            llamar.
          </p>
        </div>
        <Button asChild>
          <Link to="/clients/new">
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
            Nuevo cliente
          </Link>
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onClear={handleClearFilters}
        />

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Listado</CardTitle>
                <CardDescription>
                  {page
                    ? `${page.totalElements} clientes · página ${page.number + 1} de ${page.totalPages || 1}`
                    : "Cargando…"}
                </CardDescription>
              </div>
              <div className="w-full max-w-sm space-y-1">
                <Label htmlFor="client-search" className="sr-only">
                  Buscar clientes
                </Label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="client-search"
                    type="search"
                    placeholder="Buscar por nombre, teléfono o empresa…"
                    autoComplete="off"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-9"
                    data-testid="client-search"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Cargando…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && page?.content.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      {debouncedSearch || filters.assignedToMe
                        ? "No hay resultados para los filtros activos."
                        : "Todavía no hay clientes en cartera."}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  page?.content.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar name={client.name} />
                          <div>
                            <Link
                              to={`/clients/${client.id}`}
                              className="font-medium text-foreground hover:underline"
                            >
                              {client.name}
                            </Link>
                            {client.email && (
                              <p className="text-xs text-muted-foreground">
                                {client.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {client.phone}
                      </TableCell>
                      <TableCell>{client.company ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="success">Activo</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {page && page.totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNumber((p) => Math.max(0, p - 1))}
                  disabled={page.first || loading}
                >
                  Anterior
                </Button>
                <span>
                  Página {page.number + 1} de {page.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageNumber((p) => p + 1)}
                  disabled={page.last || loading}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {initials || "?"}
    </span>
  );
}
