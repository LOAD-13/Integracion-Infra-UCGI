import { Bell, Menu, Search } from "lucide-react";

interface HeaderProps {
  breadcrumb: string;
  title: string;
  onToggleSidebar: () => void;
  onOpenCommand?: () => void;
  onOpenNotifications?: () => void;
  unreadCount?: number;
}

export function Header({
  breadcrumb,
  title,
  onToggleSidebar,
  onOpenCommand,
  onOpenNotifications,
  unreadCount = 0,
}: HeaderProps) {
  return (
    <header className="flex h-16 flex-none items-center gap-3 border-b border-df-border bg-df-surface px-5">
      <button
        type="button"
        onClick={onToggleSidebar}
        title="Contraer panel"
        aria-label="Contraer panel"
        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg border border-df-border bg-transparent text-df-text-muted hover:bg-df-surface-2"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] font-semibold tracking-wide text-df-text-dim">
          {breadcrumb}
        </span>
        <span className="ff-display truncate text-[18px] font-bold tracking-tight text-df-text">
          {title}
        </span>
      </div>

      <button
        type="button"
        onClick={onOpenCommand}
        className="ml-auto flex h-[38px] min-w-[250px] cursor-text items-center gap-2.5 rounded-lg border border-df-border bg-df-surface-2 px-3 text-[13px] text-df-text-dim hover:border-df-border-strong"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar cliente, acción…</span>
        <kbd className="ff-mono rounded border border-df-border bg-df-surface px-1.5 py-[1px] text-[11px] text-df-text-muted">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={onOpenNotifications}
        title="Notificaciones"
        aria-label="Notificaciones"
        className="relative flex h-[38px] w-[38px] flex-none items-center justify-center rounded-lg border border-df-border bg-df-surface-2 text-df-text-muted hover:border-df-border-strong hover:text-df-text"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span
            className="absolute top-[8px] right-[9px] h-[7px] w-[7px] rounded-full"
            style={{
              background: "hsl(var(--df-hang))",
              border: "1.5px solid hsl(var(--df-surface))",
            }}
          />
        )}
      </button>
    </header>
  );
}
