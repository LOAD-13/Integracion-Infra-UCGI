import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  Users,
  LineChart,
  Megaphone,
  Phone,
  Search,
  Shield,
  Headphones,
  PauseCircle,
  Network,
  Tags as TagsIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { listClients, type Client } from "@/api/clients";

interface CommandItem {
  group: string;
  label: string;
  icon: typeof Home;
  run: () => void;
  hint?: string;
  kw?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenDialer: () => void;
}

export function CommandPalette({ open, onClose, onOpenDialer }: CommandPaletteProps) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [clientHits, setClientHits] = useState<Client[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = session?.role === "ADMIN";

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounce búsqueda de clientes.
  useEffect(() => {
    if (!open || !session || query.length < 2) {
      setClientHits([]);
      return;
    }
    const id = window.setTimeout(() => {
      listClients(session.token, { q: query, size: 5 })
        .then((page) => setClientHits(page.content))
        .catch(() => setClientHits([]));
    }, 250);
    return () => window.clearTimeout(id);
  }, [open, session, query]);

  const actions: CommandItem[] = useMemo(() => {
    const base: CommandItem[] = [
      { group: "Acciones", label: "Ir a Inicio", icon: Home, run: () => navigate("/"), kw: "inicio dashboard home" },
      { group: "Acciones", label: "Ver clientes", icon: Users, run: () => navigate("/clients"), kw: "clientes" },
      { group: "Acciones", label: "Mis métricas", icon: LineChart, run: () => navigate("/metrics"), kw: "metricas graficas" },
      { group: "Acciones", label: "Campañas", icon: Megaphone, run: () => navigate("/campaigns"), kw: "campanas outbound" },
      { group: "Acciones", label: "Abrir marcador", icon: Phone, run: () => { onClose(); onOpenDialer(); }, hint: "Ctrl+D", kw: "marcar dialer llamar numero" },
    ];
    if (isAdmin) {
      base.push(
        { group: "Administración", label: "Usuarios", icon: Shield, run: () => navigate("/admin/users"), kw: "admin usuarios" },
        { group: "Administración", label: "Skills", icon: Headphones, run: () => navigate("/admin/skills"), kw: "habilidades skills" },
        { group: "Administración", label: "Extensiones SIP", icon: Phone, run: () => navigate("/admin/sip-extensions"), kw: "sip extensions" },
        { group: "Administración", label: "Routing entrante", icon: Network, run: () => navigate("/admin/inbound-routing"), kw: "inbound routing" },
        { group: "Administración", label: "Parking IVR", icon: PauseCircle, run: () => navigate("/admin/parking"), kw: "parking ivr" },
        { group: "Administración", label: "Tags", icon: TagsIcon, run: () => navigate("/admin/tags"), kw: "tags catalogo" },
      );
    }
    return base;
  }, [navigate, isAdmin, onClose, onOpenDialer]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q) || a.kw?.includes(q));
  }, [actions, query]);

  if (!open) return null;

  const groups = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-[50] flex animate-df-fade items-start justify-center pt-[12vh]"
      style={{ background: "rgba(8,18,32,.5)" }}
      onClick={onClose}
      role="dialog"
      aria-label="Paleta de comandos"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[92vw] animate-df-in overflow-hidden rounded-[15px] border border-df-border-strong bg-df-surface shadow-[0_14px_40px_rgba(13,37,66,.16)]"
      >
        <div className="flex items-center gap-3 border-b border-df-border px-4 py-3.5">
          <Search className="h-5 w-5 text-df-text-dim" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clientes o ejecutar acción…"
            className="flex-1 border-0 bg-transparent text-[15px] text-df-text outline-none"
            aria-label="Buscar comando"
          />
          <kbd className="ff-mono rounded border border-df-border bg-df-surface-2 px-1.5 py-0.5 text-[11px] text-df-text-muted">
            ESC
          </kbd>
        </div>
        <div className="df-scroll max-h-[50vh] overflow-y-auto p-2">
          {clientHits.length > 0 && (
            <Group title="Clientes">
              {clientHits.map((c) => (
                <Row
                  key={c.id}
                  icon={Users}
                  label={c.name}
                  hint={c.phone}
                  onClick={() => { navigate(`/clients/${c.id}`); onClose(); }}
                />
              ))}
            </Group>
          )}
          {Object.entries(groups).map(([title, items]) => (
            <Group key={title} title={title}>
              {items.map((it) => (
                <Row
                  key={it.label}
                  icon={it.icon}
                  label={it.label}
                  hint={it.hint}
                  onClick={() => { it.run(); onClose(); }}
                />
              ))}
            </Group>
          ))}
          {clientHits.length === 0 && filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-df-text-muted">
              No hay resultados para “{query}”.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-df-text-dim">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[10px] border-0 bg-transparent px-2.5 py-2.5 text-left text-[13.5px] text-df-text hover:bg-df-surface-2"
    >
      <span
        className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px]"
        style={{ background: "hsl(var(--df-navy) / 0.08)", color: "hsl(var(--df-navy))" }}
      >
        <Icon className="h-[15px] w-[15px]" aria-hidden />
      </span>
      <span className="flex-1 font-semibold">{label}</span>
      {hint && <span className="ff-mono text-[11.5px] text-df-text-dim">{hint}</span>}
    </button>
  );
}
