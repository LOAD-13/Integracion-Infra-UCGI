import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { getUnreadCount } from "@/api/notifications";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { SoftphoneDock } from "@/components/softphone/SoftphoneDock";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: ReactNode;
}

const TITLES: Record<string, { breadcrumb: string; title: string }> = {
  "/": { breadcrumb: "Operación", title: "Workspace del agente" },
  "/dashboard": { breadcrumb: "Operación", title: "Workspace del agente" },
  "/clients": { breadcrumb: "Operación", title: "Clientes" },
  "/clients/new": { breadcrumb: "Clientes", title: "Nuevo cliente" },
  "/metrics": { breadcrumb: "Operación", title: "Mis métricas" },
  "/campaigns": { breadcrumb: "Operación", title: "Campañas" },
  "/admin/users": { breadcrumb: "Administración", title: "Gestión de usuarios" },
  "/admin/skills": { breadcrumb: "Administración", title: "Habilidades" },
  "/admin/sip-extensions": { breadcrumb: "Administración", title: "Extensiones SIP" },
  "/admin/inbound-routing": { breadcrumb: "Administración", title: "Routing entrante" },
  "/admin/parking": { breadcrumb: "Administración", title: "Zona de parking" },
  "/admin/tags": { breadcrumb: "Administración", title: "Catálogo de tags" },
};

function resolveTitle(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/clients/") && pathname.endsWith("/edit")) {
    return { breadcrumb: "Clientes", title: "Editar cliente" };
  }
  if (pathname.startsWith("/clients/")) {
    return { breadcrumb: "Clientes", title: "Ficha de cliente" };
  }
  return { breadcrumb: "Operación", title: "DialFlow CRM" };
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { session } = useAuth();
  const { pathname } = useLocation();
  const { breadcrumb, title } = useMemo(() => resolveTitle(pathname), [pathname]);

  // Poll unread count cada 30s.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = () => {
      getUnreadCount(session.token)
        .then((c) => { if (!cancelled) setUnread(c); })
        .catch(() => { /* silencioso */ });
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [session]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-df-bg">
      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            breadcrumb={breadcrumb}
            title={title}
            unreadCount={unread}
            onToggleSidebar={() => setCollapsed((v) => !v)}
            onOpenNotifications={() => setNotifOpen((v) => !v)}
          />
          <main className="df-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="px-8 py-6 pb-24">{children}</div>
          </main>
        </div>
      </div>
      <SoftphoneDock />
      <NotificationsPopover
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onAllRead={() => setUnread(0)}
      />
    </div>
  );
}
