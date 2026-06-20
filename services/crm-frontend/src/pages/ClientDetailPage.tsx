import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { deleteClient, getClient, type Client } from "@/api/clients";
import { CdrPanel } from "@/components/cdr/CdrPanel";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { DeleteClientDialog } from "@/components/clients/DeleteClientDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ClientDetailPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || Number.isNaN(id)) return;
    let cancelled = false;
    setLoading(true);
    getClient(session.token, id)
      .then((data) => {
        if (!cancelled) setClient(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error al cargar cliente");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, id]);

  async function handleDelete() {
    if (!session || !client) return;
    await deleteClient(session.token, client.id);
    navigate("/clients", { replace: true });
  }

  return (
    <div className="container max-w-4xl space-y-6 py-10">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/clients")}
        className="-ml-2"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
        Volver al listado
      </Button>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {client && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {client.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {client.company ?? "Sin empresa"} · {client.phone}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to={`/clients/${client.id}/edit`}>
                  <Pencil aria-hidden="true" className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
              <DeleteClientDialog
                clientName={client.name}
                onConfirm={handleDelete}
              />
            </div>
          </header>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Perfil</CardTitle>
              <CardDescription>Datos de contacto y empresa.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DataPoint label="Nombre" value={client.name} />
              <DataPoint label="Teléfono" value={client.phone} mono />
              <DataPoint label="Email" value={client.email ?? "—"} />
              <DataPoint label="Empresa" value={client.company ?? "—"} />
              <DataPoint
                label="Resumen de notas"
                value={client.notesSummary ?? "—"}
                fullSpan
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <CdrPanel
                clientId={client.id}
                fallbackNumber={client.phone}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <NotesPanel clientId={client.id} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DataPoint({
  label,
  value,
  mono,
  fullSpan,
}: {
  label: string;
  value: string;
  mono?: boolean;
  fullSpan?: boolean;
}) {
  return (
    <div className={fullSpan ? "sm:col-span-2" : undefined}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-sm text-foreground ${
          mono ? "font-mono" : ""
        }`.trim()}
      >
        {value}
      </p>
    </div>
  );
}
