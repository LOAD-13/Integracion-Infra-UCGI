import {
  Home,
  Users,
  LineChart,
  Megaphone,
  Headphones,
  Shield,
  Tags as TagsIcon,
  Network,
  PauseCircle,
  Phone,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  match: (pathname: string) => boolean;
  badge?: string;
  adminOnly?: boolean;
};

const operationItems: NavItem[] = [
  { to: "/", label: "Inicio", icon: Home, match: (p) => p === "/" || p === "/dashboard" },
  { to: "/clients", label: "Clientes", icon: Users, match: (p) => p.startsWith("/clients") },
  { to: "/metrics", label: "Métricas", icon: LineChart, match: (p) => p.startsWith("/metrics") },
  { to: "/campaigns", label: "Campañas", icon: Megaphone, match: (p) => p.startsWith("/campaigns") },
];

const adminItems: NavItem[] = [
  { to: "/admin/users", label: "Usuarios", icon: Shield, match: (p) => p === "/admin/users", adminOnly: true },
  { to: "/admin/skills", label: "Skills", icon: Headphones, match: (p) => p === "/admin/skills", adminOnly: true },
  { to: "/admin/sip-extensions", label: "Extensiones SIP", icon: Phone, match: (p) => p === "/admin/sip-extensions", adminOnly: true },
  { to: "/admin/inbound-routing", label: "Routing entrante", icon: Network, match: (p) => p === "/admin/inbound-routing", adminOnly: true },
  { to: "/admin/parking", label: "Parking IVR", icon: PauseCircle, match: (p) => p === "/admin/parking", adminOnly: true },
  { to: "/admin/tags", label: "Tags", icon: TagsIcon, match: (p) => p === "/admin/tags", adminOnly: true },
];

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const { session, signOut } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = session?.role === "ADMIN";

  return (
    <aside
      className={cn(
        "df-rail-bg df-rail-scroll flex flex-none flex-col overflow-hidden transition-[width] duration-150 ease-out",
        collapsed ? "w-[74px]" : "w-[248px]",
      )}
    >
      <div className="flex h-16 flex-none items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl bg-white p-1.5 shadow-md">
          <img src="/dialflow-icon.png" alt="DialFlow" className="block h-full w-full object-contain" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="ff-display text-[19px] font-bold tracking-tight text-white">
              Dial<span style={{ color: "hsl(var(--df-brand-bright))" }}>Flow</span>
            </span>
            <span className="mt-1 text-[9.5px] font-semibold tracking-[2.5px] text-df-rail-text">
              CRM · CALL CENTER
            </span>
          </div>
        )}
      </div>

      <nav className="df-rail-scroll flex flex-1 flex-col gap-[3px] overflow-y-auto p-3">
        {!collapsed && (
          <span className="px-3 py-2 text-[10px] font-bold tracking-[1.5px] text-df-rail-text opacity-70">
            OPERACIÓN
          </span>
        )}
        {operationItems.map((item) => (
          <NavLinkRow key={item.to} item={item} active={item.match(pathname)} collapsed={collapsed} />
        ))}

        {isAdmin && (
          <>
            {!collapsed && (
              <span className="mt-4 px-3 py-2 text-[10px] font-bold tracking-[1.5px] text-df-rail-text opacity-70">
                ADMINISTRACIÓN
              </span>
            )}
            {adminItems.map((item) => (
              <NavLinkRow key={item.to} item={item} active={item.match(pathname)} collapsed={collapsed} />
            ))}
          </>
        )}
      </nav>

      <div className="flex flex-none flex-col gap-[9px] border-t border-white/10 p-3">
        {/* Placeholder de AgentStatusSelector (lo monta PR-C). Por ahora muestra rol. */}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
          <span className="inline-flex h-[11px] w-[11px] flex-none rounded-full bg-df-st-offline" />
          {!collapsed && (
            <span className="flex flex-1 flex-col overflow-hidden text-left leading-tight">
              <span className="text-[13px] font-bold text-white">Desconectado</span>
              <span className="ff-mono text-[11px] text-df-rail-text">Sin estado activo</span>
            </span>
          )}
          {!collapsed && <ChevronDown className="h-[15px] w-[15px] text-df-rail-text" />}
        </div>

        {!collapsed && (
          <div className="flex items-center gap-3 px-1 pt-1">
            <div
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[12.5px] font-bold text-white"
              style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
              aria-hidden
            >
              {initials(session?.username)}
            </div>
            <div className="flex-1 overflow-hidden leading-tight">
              <div className="truncate text-[13px] font-bold text-white">{session?.username}</div>
              <div className="text-[11px] text-df-rail-text">
                {session?.role === "ADMIN" ? "Administrador" : "Agente"}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={signOut}
          title="Cerrar sesión"
          className="mt-1 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-left text-[13px] font-semibold text-df-rail-text hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px] flex-none" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}

function NavLinkRow({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      title={item.label}
      className={cn(
        "relative flex items-center gap-[13px] rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors",
        active ? "bg-white/10 text-white" : "text-df-rail-text hover:bg-white/[0.07]",
      )}
      style={
        active
          ? { boxShadow: "inset 3px 0 0 hsl(var(--df-brand-bright))" }
          : undefined
      }
    >
      <Icon
        className="h-5 w-5 flex-none"
        style={{ color: active ? "hsl(var(--df-brand-bright))" : undefined }}
      />
      {!collapsed && (
        <span className="flex-1 truncate whitespace-nowrap">{item.label}</span>
      )}
      {!collapsed && item.badge && (
        <span className="ff-mono flex-none rounded-full bg-white/[0.12] px-2 py-[1px] text-[11px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function initials(name: string | undefined): string {
  if (!name) return "??";
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
