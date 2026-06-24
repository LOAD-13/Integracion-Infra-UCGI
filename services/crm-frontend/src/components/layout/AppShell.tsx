import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { useSip } from "@/sip/useSip";
import { getUnreadCount } from "@/api/notifications";
import { CommandPalette } from "@/components/command/CommandPalette";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { ActiveCallPanel } from "@/components/softphone/ActiveCallPanel";
import { DialerSheet } from "@/components/softphone/DialerSheet";
import { SoftphoneDock } from "@/components/softphone/SoftphoneDock";
import { CallStage } from "@/components/softphone/CallStage";
import { DialerProvider, useDialer } from "@/components/softphone/dialer-context";
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

function resolveTitle(pathname: string, isAdmin: boolean) {
  if (TITLES[pathname]) {
    if (pathname === "/" || pathname === "/dashboard") {
      return isAdmin
        ? { breadcrumb: "Administración", title: "Panel de supervisión" }
        : TITLES[pathname];
    }
    if (pathname === "/metrics") {
      return isAdmin
        ? { breadcrumb: "Administración", title: "Métricas globales" }
        : TITLES[pathname];
    }
    return TITLES[pathname];
  }
  if (pathname.startsWith("/clients/") && pathname.endsWith("/edit")) {
    return { breadcrumb: "Clientes", title: "Editar cliente" };
  }
  if (pathname.startsWith("/clients/")) {
    return { breadcrumb: "Clientes", title: "Ficha de cliente" };
  }
  return { breadcrumb: "Operación", title: "DialFlow CRM" };
}

function ShellInner({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { session } = useAuth();
  const { state: sip, remoteStream } = useSip();
  const { open: dialerOpen, openDialer, closeDialer } = useDialer();
  const { pathname } = useLocation();
  const isAdmin = session?.role === "ADMIN";
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const { breadcrumb, title } = useMemo(
    () => resolveTitle(pathname, isAdmin),
    [pathname, isAdmin],
  );

  // CRÍTICO: bind del remoteStream al <audio> global para que se escuche el
  // otro lado en llamadas de solo audio. Sin esto el RTP llega al browser
  // pero nunca se reproduce.
  useEffect(() => {
    if (!remoteAudioRef.current) return;
    remoteAudioRef.current.srcObject = remoteStream ?? null;
    if (remoteStream) {
      const p = remoteAudioRef.current.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => { /* autoplay bloqueado: el primer click lo destraba */ });
      }
    }
  }, [remoteStream]);

  // Unread count cada 30s.
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

  // Listener global de teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;
      if (cmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      } else if (cmdOrCtrl && e.key.toLowerCase() === "d" && !isAdmin) {
        e.preventDefault();
        openDialer();
      } else if (e.key === "Escape") {
        setCommandOpen(false);
        closeDialer();
        setPanelOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin, openDialer, closeDialer]);

  // Tipo "Teams": al conectar la llamada abrimos el stage central + panel
  // lateral con datos del cliente. Al colgar cerramos todo.
  useEffect(() => {
    if (isAdmin) return;
    if (sip.call === "connected") {
      setStageOpen(true);
      setPanelOpen(true);
    }
    if (sip.call === "idle") {
      setStageOpen(false);
      setPanelOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sip.call, isAdmin]);

  const callActive = !isAdmin && (sip.call === "connected" || sip.call === "on-hold");

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
            onOpenCommand={() => setCommandOpen(true)}
            onOpenNotifications={() => setNotifOpen((v) => !v)}
          />
          <main className="df-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="px-8 py-6 pb-24">{children}</div>
          </main>
        </div>
      </div>
      {/* Audio invisible que reproduce el RTP remoto en llamadas de solo audio. */}
      {!isAdmin && (
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          data-df-remote="1"
          style={{ display: "none" }}
          aria-hidden
        />
      )}
      {/* Admin no llama: oculta softphone, dialer y overlays de llamada. */}
      {!isAdmin && <SoftphoneDock minimized={callActive} onOpenStage={() => setStageOpen(true)} />}
      {!isAdmin && <DialerSheet open={dialerOpen} onClose={closeDialer} />}
      {!isAdmin && (
        <ActiveCallPanel
          open={panelOpen && callActive}
          onClose={() => setPanelOpen(false)}
        />
      )}
      {!isAdmin && (
        <CallStage
          open={stageOpen && callActive}
          onMinimize={() => setStageOpen(false)}
          sideOffset={panelOpen ? 420 : 0}
        />
      )}
      <NotificationsPopover
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onAllRead={() => setUnread(0)}
      />
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onOpenDialer={() => !isAdmin && openDialer()}
      />
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <DialerProvider>
      <ShellInner>{children}</ShellInner>
    </DialerProvider>
  );
}
