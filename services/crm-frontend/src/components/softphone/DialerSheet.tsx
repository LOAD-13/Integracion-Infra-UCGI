import { useEffect, useState } from "react";
import { Delete, Phone, X } from "lucide-react";
import { useSip } from "@/sip/useSip";

interface DialerSheetProps {
  open: boolean;
  onClose: () => void;
}

const KEYS: Array<{ k: string; sub: string }> = [
  { k: "1", sub: "" }, { k: "2", sub: "ABC" }, { k: "3", sub: "DEF" },
  { k: "4", sub: "GHI" }, { k: "5", sub: "JKL" }, { k: "6", sub: "MNO" },
  { k: "7", sub: "PQRS" }, { k: "8", sub: "TUV" }, { k: "9", sub: "WXYZ" },
  { k: "*", sub: "" }, { k: "0", sub: "+" }, { k: "#", sub: "" },
];

export function DialerSheet({ open, onClose }: DialerSheetProps) {
  const { state, call } = useSip();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (/^[0-9*#]$/.test(e.key)) setValue((v) => v + e.key);
      else if (e.key === "Backspace") setValue((v) => v.slice(0, -1));
      else if (e.key === "Enter") {
        void doCall();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  if (!open) return null;

  async function doCall() {
    const target = value.trim();
    if (!target) return;
    if (state.registration !== "registered" || state.call !== "idle") return;
    try {
      await call(target);
      onClose();
    } catch { /* ignore */ }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 animate-df-fade"
        style={{ background: "rgba(8,18,32,.45)" }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed bottom-0 right-0 top-0 z-[41] flex w-[360px] animate-df-slidein flex-col border-l border-df-border bg-df-surface p-5 shadow-[0_14px_40px_rgba(13,37,66,.16)]"
        role="dialog"
        aria-label="Marcador"
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="ff-display text-[16px] font-bold text-df-text">Marcador</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-df-border bg-transparent text-df-text-muted hover:bg-df-surface-2"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 flex min-h-[58px] items-center justify-center rounded-[13px] border border-df-border bg-df-surface-2 px-4">
          <span
            className="ff-mono text-[25px] font-semibold tracking-widest"
            style={{ color: value ? "hsl(var(--df-text))" : "hsl(var(--df-text-dim))" }}
          >
            {value || "Ingresá un número"}
          </span>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-3">
          {KEYS.map((k) => (
            <button
              key={k.k}
              type="button"
              onClick={() => setValue((v) => v + k.k)}
              className="ff-mono flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-[15px] border border-df-border bg-df-surface-2 text-df-text hover:border-df-brand hover:bg-df-brand-soft"
              aria-label={`Marcar ${k.k}`}
            >
              <span className="text-[23px] font-semibold">{k.k}</span>
              {k.sub && <span className="text-[9px] tracking-widest text-df-text-dim">{k.sub}</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void doCall()}
            disabled={!value || state.registration !== "registered" || state.call !== "idle"}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[15px] border-0 text-[15px] font-bold text-white hover:brightness-110 disabled:opacity-60"
            style={{ background: "hsl(var(--df-call))" }}
            aria-label="Llamar"
          >
            <Phone className="h-5 w-5" aria-hidden />
            Llamar
          </button>
          <button
            type="button"
            onClick={() => setValue((v) => v.slice(0, -1))}
            className="flex h-14 w-14 flex-none items-center justify-center rounded-[15px] border border-df-border bg-df-surface-2 text-df-text-muted hover:text-df-text"
            aria-label="Borrar último"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </>
  );
}
