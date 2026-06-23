import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Pencil, Phone, Video } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { useSip } from "@/sip/useSip";
import { deleteClient, getClient, type Client } from "@/api/clients";
import { CdrPanel } from "@/components/cdr/CdrPanel";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { DeleteClientDialog } from "@/components/clients/DeleteClientDialog";
import { cn } from "@/lib/utils";

type TabKey = "datos" | "historial" | "notas";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "datos", label: "Datos" },
  { key: "historial", label: "Historial" },
  { key: "notas", label: "Notas" },
];

export function ClientDetailPage() {
  const { session } = useAuth();
  const { call } = useSip();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("datos");

  useEffect(() => {
    if (!session || Number.isNaN(id)) return;
    let cancelled = false;
    setLoading(true);
    getClient(session.token, id)
      .then((data) => { if (!cancelled) setClient(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar cliente");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, id]);

  async function handleDelete() {
    if (!session || !client) return;
    await deleteClient(session.token, client.id);
    navigate("/clients", { replace: true });
  }

  if (loading) return <p className="text-sm text-df-text-muted">Cargando…</p>;
  if (error) return <p role="alert" className="text-sm" style={{ color: "hsl(var(--df-hang))" }}>{error}</p>;
  if (!client) return null;

  return (
    <div className="flex flex-col gap-5 animate-df-fade">
      <button
        type="button"
        onClick={() => navigate("/clients")}
        className="flex items-center gap-1.5 self-start border-0 bg-transparent p-0 text-[13px] font-semibold text-df-text-muted hover:text-df-text"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a clientes
      </button>

      <div className="grid gap-5" style={{ gridTemplateColumns: "312px 1fr" }}>
        {/* Sidebar perfil */}
        <div className="flex flex-col gap-4 rounded-2xl border border-df-border bg-df-surface p-5 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex h-[74px] w-[74px] items-center justify-center rounded-full text-[26px] font-bold text-white"
              style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
              aria-hidden
            >
              {initials(client.name)}
            </div>
            <div>
              <div className="ff-display text-[18px] font-bold text-df-text">{client.name}</div>
              <div className="mt-0.5 text-[12.5px] text-df-text-dim">{client.company ?? "Sin empresa"}</div>
            </div>
            {client.tags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {client.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: t.colorBg, color: t.colorText }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void call(client.phone)}
              className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[11px] border-0 text-[13.5px] font-bold text-white hover:brightness-110"
              style={{ background: "hsl(var(--df-call))" }}
              aria-label="Llamar al cliente"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Llamar
            </button>
            <button
              type="button"
              onClick={() => void call(client.phone)}
              title="Videollamada"
              aria-label="Videollamada"
              className="flex h-10 w-12 flex-none items-center justify-center rounded-[11px] border border-df-border bg-df-surface-2 text-df-brand-ink hover:border-df-brand hover:bg-df-brand-soft"
            >
              <Video className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="flex flex-col gap-3 border-t border-df-border pt-3">
            <Field icon={Phone} label="Teléfono" value={client.phone} mono />
            <Field icon={Mail} label="Email" value={client.email ?? "—"} />
            <Field icon={MapPin} label="Empresa" value={client.company ?? "—"} />
          </div>
          <div className="mt-1 flex gap-2 border-t border-df-border pt-3">
            <Link
              to={`/clients/${client.id}/edit`}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-df-border bg-df-surface-2 text-[12.5px] font-semibold text-df-text-muted hover:border-df-border-strong hover:text-df-text"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Link>
            <DeleteClientDialog clientName={client.name} onConfirm={handleDelete} />
          </div>
        </div>

        {/* Tabs */}
        <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
          <div className="flex gap-0.5 border-b border-df-border px-2 pt-2">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 border-0 bg-transparent px-4 py-2.5 text-[13.5px] font-bold",
                    active ? "text-df-navy" : "text-df-text-muted",
                  )}
                  style={{
                    borderBottom: active ? "2px solid hsl(var(--df-brand))" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "datos" && (
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              <DataCell label="Nombre" value={client.name} />
              <DataCell label="Teléfono" value={client.phone} mono />
              <DataCell label="Email" value={client.email ?? "—"} />
              <DataCell label="Empresa" value={client.company ?? "—"} />
              <DataCell label="Resumen de notas" value={client.notesSummary ?? "—"} fullSpan />
            </div>
          )}
          {tab === "historial" && (
            <div className="p-5">
              <CdrPanel clientId={client.id} fallbackNumber={client.phone} />
            </div>
          )}
          {tab === "notas" && (
            <div className="p-5">
              <NotesPanel clientId={client.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, mono }: { icon: typeof Phone; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 flex-none text-df-text-dim" aria-hidden />
      <div className="min-w-0">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-df-text-dim">{label}</div>
        <div className={cn("truncate text-[13px] font-semibold text-df-text", mono && "ff-mono")}>{value}</div>
      </div>
    </div>
  );
}

function DataCell({ label, value, mono, fullSpan }: { label: string; value: string; mono?: boolean; fullSpan?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[11px] border border-df-border bg-df-surface-2 p-3.5",
        fullSpan && "sm:col-span-2",
      )}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-wider text-df-text-dim">{label}</span>
      <span className={cn("text-[14px] font-semibold text-df-text", mono && "ff-mono")}>{value}</span>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
