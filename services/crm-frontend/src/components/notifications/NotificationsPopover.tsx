import { useEffect, useRef, useState } from "react";
import { Bell, FileEdit, LineChart, PhoneMissed, UserPlus, Info } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  type Notification,
  type NotificationKind,
} from "@/api/notifications";
import { useAuth } from "@/auth/useAuth";

const KIND_STYLE: Record<NotificationKind, { Icon: typeof Bell; bg: string; color: string }> = {
  MISSED_CALL: { Icon: PhoneMissed, bg: "hsl(var(--df-hang) / 0.11)", color: "hsl(var(--df-hang))" },
  NOTE_ASSIGNED: { Icon: FileEdit, bg: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" },
  NEW_CLIENT: { Icon: UserPlus, bg: "hsl(var(--df-navy) / 0.08)", color: "hsl(var(--df-navy))" },
  METRICS_UPDATED: { Icon: LineChart, bg: "hsl(var(--df-call) / 0.13)", color: "hsl(var(--df-call))" },
  SYSTEM: { Icon: Info, bg: "hsl(var(--df-surface-3))", color: "hsl(var(--df-text-muted))" },
};

interface NotificationsPopoverProps {
  open: boolean;
  onClose: () => void;
  onAllRead: () => void;
}

export function NotificationsPopover({ open, onClose, onAllRead }: NotificationsPopoverProps) {
  const { session } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !session) return;
    let cancelled = false;
    listNotifications(session.token, false)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { /* silencioso */ });
    return () => { cancelled = true; };
  }, [open, session]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleMarkAllRead() {
    if (!session) return;
    try {
      await markAllNotificationsRead(session.token);
      setItems((rows) => rows.map((r) => ({ ...r, readAt: r.readAt ?? new Date().toISOString() })));
      onAllRead();
    } catch { /* ignore */ }
  }

  return (
    <div
      ref={containerRef}
      className="fixed right-32 top-[62px] z-[55] w-[344px] animate-df-in overflow-hidden rounded-2xl border border-df-border-strong bg-df-surface shadow-[0_14px_40px_rgba(13,37,66,.16)]"
      role="dialog"
      aria-label="Notificaciones"
    >
      <div className="flex items-center justify-between border-b border-df-border px-4 py-3.5">
        <span className="ff-display text-[14.5px] font-bold text-df-text">Notificaciones</span>
        <button
          type="button"
          onClick={() => void handleMarkAllRead()}
          className="text-[12px] font-semibold text-df-brand-ink hover:underline"
        >
          Marcar leídas
        </button>
      </div>
      <div className="df-scroll max-h-[340px] overflow-y-auto">
        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-df-text-muted">
            No hay notificaciones todavía.
          </div>
        )}
        {items.map((n) => {
          const { Icon, bg, color } = KIND_STYLE[n.kind];
          const isUnread = n.readAt === null;
          return (
            <div
              key={n.id}
              className="flex cursor-pointer items-start gap-3 border-b border-df-border px-4 py-3 hover:bg-df-surface-2"
            >
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
                style={{ background: bg, color }}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className={isUnread ? "text-[13px] font-semibold text-df-text" : "text-[13px] font-normal text-df-text-muted"}>
                  {n.title}
                </div>
                <div className="mt-0.5 text-[11.5px] text-df-text-dim">
                  {formatRelative(n.createdAt)}
                </div>
              </div>
              {isUnread && (
                <span
                  className="mt-1.5 inline-block h-2 w-2 flex-none rounded-full"
                  style={{ background: "hsl(var(--df-brand))" }}
                  aria-label="No leída"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "Hace unos segundos";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} h`;
  return new Date(iso).toLocaleDateString();
}
