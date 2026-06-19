import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { listClients, type Client, type PageResponse } from "@/api/clients";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PAGE_SIZE = 20;

export function ClientsPage() {
  const { session } = useAuth();
  const [page, setPage] = useState<PageResponse<Client> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listClients(session.token, { page: pageNumber, size: PAGE_SIZE })
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
  }, [session, pageNumber]);

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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Listado</CardTitle>
          <CardDescription>
            {page
              ? `${page.totalElements} clientes · página ${page.number + 1} de ${page.totalPages || 1}`
              : "Cargando…"}
          </CardDescription>
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && page?.content.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Todavía no hay clientes en cartera.
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
