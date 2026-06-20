import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Phone,
  PhoneOff,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { listCdr, type CdrEntry } from "@/api/cdr";
import type { PageResponse } from "@/api/clients";
import { useSip } from "@/sip/useSip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CdrPanelProps {
  clientId: number;
  /** Teléfono del cliente al que se llamará en click-to-call. */
  fallbackNumber: string;
  pageSize?: number;
}

export function CdrPanel({
  clientId,
  fallbackNumber,
  pageSize = 10,
}: CdrPanelProps) {
  const { session } = useAuth();
  const { state, call } = useSip();
  const [page, setPage] = useState<PageResponse<CdrEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCdr(session.token, { clientId, page: pageNumber, size: pageSize })
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Error al cargar CDR");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, clientId, pageNumber, pageSize]);

  async function handleCallback(target: string) {
    try {
      await call(target);
    } catch {
      // El estado del SipClient ya reflejará el fallo
    }
  }

  const canCall = state.registration === "registered" && state.call === "idle";

  return (
    <div className="space-y-4" data-testid="cdr-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Histórico de llamadas</h3>
          <p className="text-xs text-muted-foreground">
            {page
              ? `${page.totalElements} llamadas · página ${page.number + 1} de ${page.totalPages || 1}`
              : "Cargando…"}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => handleCallback(fallbackNumber)}
          disabled={!canCall || !fallbackNumber}
          aria-label={`Llamar a ${fallbackNumber}`}
        >
          <Phone aria-hidden="true" className="mr-2 h-4 w-4" />
          Llamar al cliente
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Duración</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                Cargando…
              </TableCell>
            </TableRow>
          )}
          {!loading && page?.content.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                Todavía no hay llamadas registradas para este cliente.
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            page?.content.map((cdr) => (
              <TableRow key={cdr.id}>
                <TableCell className="font-mono text-xs">
                  {formatDateTime(cdr.startTime)}
                </TableCell>
                <TableCell>
                  <DirectionLabel value={cdr.direction} />
                </TableCell>
                <TableCell>
                  <DispositionBadge value={cdr.disposition} />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatDuration(cdr.durationSeconds)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleCallback(
                        cdr.direction === "OUTBOUND"
                          ? cdr.calleeNumber
                          : cdr.callerNumber,
                      )
                    }
                    disabled={!canCall}
                    aria-label="Volver a llamar"
                  >
                    <Phone aria-hidden="true" className="mr-1 h-4 w-4" />
                    Llamar
                  </Button>
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
            {page.number + 1} / {page.totalPages}
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
    </div>
  );
}

function DirectionLabel({ value }: { value: CdrEntry["direction"] }) {
  if (value === "INBOUND") {
    return (
      <span className="flex items-center gap-1 text-sm">
        <ArrowDownLeft aria-hidden="true" className="h-4 w-4 text-emerald-600" />
        Entrante
      </span>
    );
  }
  if (value === "OUTBOUND") {
    return (
      <span className="flex items-center gap-1 text-sm">
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-blue-600" />
        Saliente
      </span>
    );
  }
  if (value === "INTERNAL") {
    return (
      <span className="flex items-center gap-1 text-sm">
        <ArrowRightLeft aria-hidden="true" className="h-4 w-4" />
        Interna
      </span>
    );
  }
  return <span className="text-sm text-muted-foreground">—</span>;
}

function DispositionBadge({ value }: { value: CdrEntry["disposition"] }) {
  if (value === "ANSWERED") return <Badge variant="success">Contestada</Badge>;
  if (value === "NO_ANSWER")
    return (
      <Badge variant="secondary">
        <PhoneOff aria-hidden="true" className="mr-1 h-3 w-3" />
        Sin respuesta
      </Badge>
    );
  if (value === "BUSY") return <Badge variant="secondary">Ocupado</Badge>;
  if (value === "FAILED") return <Badge variant="destructive">Fallida</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
