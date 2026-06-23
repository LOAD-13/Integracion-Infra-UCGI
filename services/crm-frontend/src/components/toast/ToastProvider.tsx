import { useCallback, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, AlertTriangle, PhoneOff } from "lucide-react";
import { ToastContext, type Toast, type ToastKind } from "./toast-context";

const KIND_STYLE: Record<ToastKind, { accent: string; Icon: typeof Info }> = {
  ok: { accent: "hsl(var(--df-call))", Icon: CheckCircle2 },
  info: { accent: "hsl(var(--df-brand))", Icon: Info },
  warn: { accent: "hsl(var(--df-st-break))", Icon: AlertTriangle },
  end: { accent: "hsl(var(--df-hang))", Icon: PhoneOff },
};

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((current) => [...current, { ...t, id }]);
    setTimeout(() => dismiss(id), 3600);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      className="pointer-events-none fixed bottom-20 right-5 z-[70] flex flex-col items-end gap-2.5"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => {
        const { accent, Icon } = KIND_STYLE[t.kind];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex min-w-[260px] max-w-sm animate-df-slidein items-center gap-3 rounded-xl border border-df-border-strong bg-df-surface p-3 pl-3.5 shadow-[0_14px_40px_rgba(13,37,66,.16)]"
            style={{ borderLeft: `3px solid ${accent}` }}
            role="status"
          >
            <Icon className="h-5 w-5 flex-none" style={{ color: accent }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-df-text">{t.title}</div>
              {t.desc && (
                <div className="mt-0.5 text-[12px] text-df-text-muted">{t.desc}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

