import { useEffect, useRef, useState } from "react";
import {
  Headphones,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Play,
  Smartphone,
  Video,
} from "lucide-react";
import { useSip } from "@/sip/useSip";
import { cn } from "@/lib/utils";

/**
 * SoftphoneDock — barra persistente abajo de la app con 3 estados:
 *  - idle: registro + "Marcar" + "Simular entrante".
 *  - ringing-incoming: avatar pulsando + Rechazar/Contestar.
 *  - active: nombre + timer + controles mute/hold/video/transfer/Panel/Colgar.
 *
 * Reusa el hook useSip existente — NO modifica la logica SIP.
 */
export function SoftphoneDock() {
  const { state, answer, hangup, toggleMute, toggleHold, toggleVideo } = useSip();
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [timer, setTimer] = useState("00:00");
  const tickRef = useRef<number | null>(null);

  // Cuando la llamada pasa a connected, marcamos el inicio. Cuando vuelve a
  // idle, lo limpiamos y reseteamos el contador.
  useEffect(() => {
    if (state.call === "connected" && callStartedAt === null) {
      setCallStartedAt(Date.now());
    }
    if (state.call === "idle") {
      setCallStartedAt(null);
      setTimer("00:00");
    }
  }, [state.call, callStartedAt]);

  useEffect(() => {
    if (callStartedAt === null) return;
    const update = () => {
      const sec = Math.floor((Date.now() - callStartedAt) / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      setTimer(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    tickRef.current = window.setInterval(update, 1000);
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
    };
  }, [callStartedAt]);

  const registered = state.registration === "registered";
  const isIncoming = state.call === "incoming";
  const inActive =
    state.call === "connected" || state.call === "on-hold" || state.call === "outgoing";

  return (
    <div
      className="flex-none border-t border-df-border bg-df-surface"
      style={{ boxShadow: "0 -6px 24px rgba(13,37,66,.07)" }}
    >
      {state.call === "idle" && <IdleRow registered={registered} />}
      {isIncoming && (
        <IncomingRow
          remoteIdentity={state.remoteIdentity}
          onAnswer={() => void answer()}
          onDecline={() => void hangup()}
        />
      )}
      {inActive && (
        <ActiveRow
          callState={state.call as "connected" | "on-hold" | "outgoing"}
          remoteIdentity={state.remoteIdentity}
          timer={timer}
          muted={state.muted}
          hold={state.call === "on-hold"}
          videoOn={state.videoEnabled}
          onToggleMute={toggleMute}
          onToggleHold={() => void toggleHold()}
          onToggleVideo={() => void toggleVideo()}
          onHangup={() => void hangup()}
        />
      )}
    </div>
  );
}

function IdleRow({ registered }: { registered: boolean }) {
  return (
    <div className="flex h-16 items-center gap-4 px-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg"
          style={{ background: "hsl(var(--df-navy) / 0.08)", color: "hsl(var(--df-navy))" }}
        >
          <Headphones className="h-[18px] w-[18px]" />
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-bold text-df-text">Softphone</div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-df-text-dim">
            <span
              className="inline-block h-[7px] w-[7px] rounded-full"
              style={{ background: registered ? "hsl(var(--df-call))" : "hsl(var(--df-st-offline))" }}
            />
            {registered ? "Registrado" : "No registrado"}
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <button
          type="button"
          disabled={!registered}
          className="flex h-10 items-center gap-2 rounded-[11px] border border-df-border bg-df-surface-2 px-4 text-[13px] font-semibold text-df-text hover:border-df-call disabled:opacity-60"
          aria-label="Abrir marcador"
        >
          <Smartphone className="h-4 w-4" style={{ color: "hsl(var(--df-call))" }} aria-hidden />
          Marcar
        </button>
      </div>
    </div>
  );
}

function IncomingRow({
  remoteIdentity,
  onAnswer,
  onDecline,
}: {
  remoteIdentity: string | null;
  onAnswer: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      className="flex h-24 items-center gap-4 px-5"
      style={{
        background: "linear-gradient(90deg, hsl(var(--df-call) / 0.13), transparent)",
      }}
    >
      <span
        className="flex h-[54px] w-[54px] flex-none animate-df-ring items-center justify-center rounded-full text-[18px] font-bold text-white"
        style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
        aria-hidden
      >
        {initials(remoteIdentity)}
      </span>
      <div className="min-w-0">
        <div
          className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide"
          style={{ color: "hsl(var(--df-call))" }}
        >
          <span
            className="inline-block h-2 w-2 animate-df-pulse rounded-full"
            style={{ background: "hsl(var(--df-call))" }}
          />
          LLAMADA ENTRANTE
        </div>
        <div className="ff-display mt-0.5 text-[18px] font-bold text-df-text">
          {remoteIdentity ?? "Número desconocido"}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={onDecline}
          className="flex h-12 items-center gap-2 rounded-[13px] border-0 px-5 text-[14px] font-bold text-white hover:brightness-110"
          style={{ background: "hsl(var(--df-hang))" }}
          aria-label="Rechazar llamada"
        >
          <PhoneOff className="h-[18px] w-[18px]" aria-hidden />
          Rechazar
        </button>
        <button
          type="button"
          onClick={onAnswer}
          className="flex h-12 items-center gap-2 rounded-[13px] border-0 px-6 text-[14px] font-bold text-white hover:brightness-110"
          style={{
            background: "hsl(var(--df-call))",
            boxShadow: "0 0 0 4px hsl(var(--df-call) / 0.13)",
          }}
          aria-label="Contestar llamada"
        >
          <PhoneIncoming className="h-[18px] w-[18px]" aria-hidden />
          Contestar
        </button>
      </div>
    </div>
  );
}

interface ActiveRowProps {
  callState: "connected" | "on-hold" | "outgoing";
  remoteIdentity: string | null;
  timer: string;
  muted: boolean;
  hold: boolean;
  videoOn: boolean;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onToggleVideo: () => void;
  onHangup: () => void;
}

function ActiveRow({
  callState,
  remoteIdentity,
  timer,
  muted,
  hold,
  videoOn,
  onToggleMute,
  onToggleHold,
  onToggleVideo,
  onHangup,
}: ActiveRowProps) {
  const phaseLabel =
    callState === "outgoing" ? "LLAMANDO…" : hold ? "EN ESPERA" : "EN LLAMADA";
  const phaseColor = callState === "outgoing" || hold ? "var(--df-st-break)" : "var(--df-call)";

  return (
    <div className="flex h-24 items-center gap-4 px-5">
      <span
        className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-full text-[17px] font-bold text-white"
        style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
        aria-hidden
      >
        {initials(remoteIdentity)}
      </span>
      <div className="min-w-0">
        <div
          className="text-[11px] font-bold tracking-wide"
          style={{ color: `hsl(${phaseColor})` }}
        >
          {phaseLabel}
        </div>
        <div className="ff-display text-[16px] font-bold text-df-text">
          {remoteIdentity ?? "—"}
        </div>
      </div>
      <div className="ml-3 flex h-[50px] items-center gap-2 border-x border-df-border px-4">
        <span
          className="inline-block h-[9px] w-[9px] animate-df-pulse rounded-full"
          style={{ background: "hsl(var(--df-call))" }}
        />
        <span className="ff-mono text-[22px] font-semibold tracking-wider text-df-text">
          {timer}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <DockIconButton
          active={muted}
          onClick={onToggleMute}
          activeColor="hang"
          aria-label={muted ? "Quitar silencio" : "Silenciar micrófono"}
        >
          {muted ? <MicOff className="h-[19px] w-[19px]" /> : <Mic className="h-[19px] w-[19px]" />}
        </DockIconButton>
        <DockIconButton
          active={hold}
          onClick={onToggleHold}
          activeColor="break"
          aria-label={hold ? "Reanudar llamada" : "Poner en espera"}
        >
          {hold ? <Play className="h-[19px] w-[19px]" /> : <Pause className="h-[19px] w-[19px]" />}
        </DockIconButton>
        <DockIconButton
          active={videoOn}
          onClick={onToggleVideo}
          activeColor="brand"
          aria-label={videoOn ? "Apagar video" : "Activar video"}
        >
          <Video className="h-[19px] w-[19px]" />
        </DockIconButton>
        <button
          type="button"
          onClick={onHangup}
          className="flex h-[46px] items-center gap-2 rounded-[12px] border-0 px-5 text-[14px] font-bold text-white hover:brightness-110"
          style={{ background: "hsl(var(--df-hang))" }}
          aria-label="Colgar"
        >
          <Phone className="h-[18px] w-[18px] rotate-[135deg]" aria-hidden />
          Colgar
        </button>
      </div>
    </div>
  );
}

function DockIconButton({
  active,
  activeColor,
  onClick,
  children,
  ...rest
}: {
  active: boolean;
  activeColor: "hang" | "break" | "brand";
  onClick: () => void;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLButtonElement>) {
  const palette = {
    hang: { bg: "hsl(var(--df-hang) / 0.11)", border: "hsl(var(--df-hang))", color: "hsl(var(--df-hang))" },
    break: { bg: "hsl(var(--df-st-break) / 0.14)", border: "hsl(var(--df-st-break))", color: "hsl(var(--df-st-break))" },
    brand: { bg: "hsl(var(--df-brand) / 0.13)", border: "hsl(var(--df-brand))", color: "hsl(var(--df-brand-ink))" },
  }[activeColor];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[46px] w-[46px] items-center justify-center rounded-[12px] border",
        active ? "" : "bg-df-surface-2 text-df-text-muted",
      )}
      style={
        active
          ? { background: palette.bg, borderColor: palette.border, color: palette.color }
          : { borderColor: "hsl(var(--df-border))" }
      }
      {...rest}
    >
      {children}
    </button>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  if (!clean) return "?";
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
