import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createClient,
  getClient,
  updateClient,
  type Client,
} from "@/api/clients";
import { listClientTags, type ClientTag } from "@/api/clientTags";
import { ClientForm } from "@/components/clients/ClientForm";
import {
  emptyClient,
  type ClientFormValues,
} from "@/clients/client-schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ClientFormPageProps {
  mode: "create" | "edit";
}

export function ClientFormPage({ mode }: ClientFormPageProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = mode === "edit" ? Number(params.id) : null;

  const [defaults, setDefaults] = useState<ClientFormValues>(emptyClient);
  const [tags, setTags] = useState<ClientTag[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Carga catálogo de tags.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    listClientTags(session.token)
      .then((r) => { if (!cancelled) setTags(r); })
      .catch(() => { /* tags es opcional para crear */ });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (mode !== "edit" || !session || id === null || Number.isNaN(id)) return;
    let cancelled = false;
    setLoading(true);
    getClient(session.token, id)
      .then((client) => {
        if (cancelled) return;
        setDefaults(toFormValues(client));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar cliente");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, session, id]);

  async function handleSubmit(values: ClientFormValues) {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "create") {
        const created = await createClient(session.token, values);
        navigate(`/clients/${created.id}`);
      } else if (id !== null) {
        await updateClient(session.token, id, values);
        navigate(`/clients/${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cliente");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "create" ? "Nuevo cliente" : "Editar cliente";
  const submitLabel = mode === "create" ? "Crear cliente" : "Guardar cambios";

  return (
    <div className="container max-w-3xl space-y-6 py-10">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="-ml-2"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
        Volver
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Completá los datos del cliente. El teléfono es el número público al que llamamos (no la extensión interna)."
              : "Editá la ficha del cliente."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <ClientForm
              defaultValues={defaults}
              submitLabel={submitLabel}
              submitting={submitting}
              errorMessage={error}
              availableTags={tags}
              onSubmit={handleSubmit}
              onCancel={() => navigate(-1)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function toFormValues(client: Client): ClientFormValues {
  return {
    name: client.name,
    phone: client.phone,
    email: client.email ?? "",
    company: client.company ?? "",
    notesSummary: client.notesSummary ?? "",
    tagIds: client.tags.map((t) => t.id),
  };
}
