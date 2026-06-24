import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Mic,
  MicOff,
  Minimize2,
  Monitor,
  Phone,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { useSip } from "@/sip/useSip";

interface CallStageProps {
  open: boolean;
  onMinimize: () => void;
  /** Pixeles a respetar a la derecha (cuando el ActiveCallPanel está abierto). */
  sideOffset?: number;
}

/**
 * Overlay central tipo Teams que aparece SIEMPRE al contestar.
 * Muestra video del interlocutor si llegó un track de video; si no,
 * el avatar grande del remoto. Tu cámara va al PiP cuando está prendida.
 * El render es independiente del {@code videoEnabled} local — depende
 * de si el {@link MediaStream} remoto tiene tracks de video vivos.
 */
export function CallStage({ open, onMinimize, sideOffset = 0 }: CallStageProps) {
  const { state, hangup, toggleMute, toggleVideo, localStream, remoteStream } = useSip();
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [timer, setTimer] = useState("00:00");
  const [volume, setVolume] = useState(80);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const [localHasVideo, setLocalHasVideo] = useState(false);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (open && state.call === "connected" && callStartedAt === null) {
      setCallStartedAt(Date.now());
    }
    if (!open || state.call === "idle") {
      setCallStartedAt(null);
      setTimer("00:00");
    }
  }, [open, state.call, callStartedAt]);

  useEffect(() => {
    if (callStartedAt === null) return;
    const update = () => {
      const sec = Math.floor((Date.now() - callStartedAt) / 1000);
      setTimer(`${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [callStartedAt]);

  // hasVideo = el track existe, está vivo, enabled, y NO está muted.
  // El `track.muted` cambia cuando dejan de llegar frames (peer apagó la
  // cámara con replaceTrack(null) sin re-INVITE) — así escondemos el frame
  // congelado y mostramos el avatar.
  useEffect(() => {
    const compute = (s: MediaStream | null) =>
      !!s && s.getVideoTracks().some((t) =>
        t.readyState === "live" && t.enabled && !t.muted,
      );
    setRemoteHasVideo(compute(remoteStream));
    if (!remoteStream) return;
    const refresh = () => setRemoteHasVideo(compute(remoteStream));
    remoteStream.addEventListener("addtrack", refresh);
    remoteStream.addEventListener("removetrack", refresh);
    const trackListeners: Array<() => void> = [];
    for (const t of remoteStream.getVideoTracks()) {
      t.addEventListener("mute", refresh);
      t.addEventListener("unmute", refresh);
      t.addEventListener("ended", refresh);
      trackListeners.push(() => {
        t.removeEventListener("mute", refresh);
        t.removeEventListener("unmute", refresh);
        t.removeEventListener("ended", refresh);
      });
    }
    return () => {
      remoteStream.removeEventListener("addtrack", refresh);
      remoteStream.removeEventListener("removetrack", refresh);
      trackListeners.forEach((unhook) => unhook());
    };
  }, [remoteStream]);

  useEffect(() => {
    const compute = (s: MediaStream | null) =>
      !!s && s.getVideoTracks().some((t) =>
        t.readyState === "live" && t.enabled && !t.muted,
      );
    setLocalHasVideo(compute(localStream));
    if (!localStream) return;
    const refresh = () => setLocalHasVideo(compute(localStream));
    localStream.addEventListener("addtrack", refresh);
    localStream.addEventListener("removetrack", refresh);
    const trackListeners: Array<() => void> = [];
    for (const t of localStream.getVideoTracks()) {
      t.addEventListener("mute", refresh);
      t.addEventListener("unmute", refresh);
      t.addEventListener("ended", refresh);
      trackListeners.push(() => {
        t.removeEventListener("mute", refresh);
        t.removeEventListener("unmute", refresh);
        t.removeEventListener("ended", refresh);
      });
    }
    return () => {
      localStream.removeEventListener("addtrack", refresh);
      localStream.removeEventListener("removetrack", refresh);
      trackListeners.forEach((unhook) => unhook());
    };
  }, [localStream]);

  // Bind de los <video>. El remoto siempre recibe el stream — el render
  // condicional decide si se ve o no.
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream ?? null;
    }
  }, [remoteStream, remoteHasVideo]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream ?? null;
    }
  }, [localStream, localHasVideo]);

  if (!open) return null;

  const remote = state.remoteIdentity ?? "Conectando…";
  const isVideoCall = remoteHasVideo || localHasVideo || state.videoEnabled;
  const label = isVideoCall ? "EN VIDEOLLAMADA" : "EN LLAMADA";

  return (
    <div
      className="fixed inset-0 z-[44] flex animate-df-fade items-center justify-center p-8"
      style={{ background: "rgba(6,14,26,.78)", paddingRight: sideOffset + 32 }}
      role="dialog"
      aria-label={isVideoCall ? "Videollamada en curso" : "Llamada en curso"}
    >
      <div
        className="relative flex h-[600px] max-h-[88vh] w-[980px] max-w-[94vw] animate-df-pop flex-col overflow-hidden rounded-[20px] shadow-[0_30px_80px_rgba(0,0,0,.6)]"
        style={{ background: "#0a1626", border: "1px solid #1c2c44" }}
      >
        <div className="absolute left-0 right-0 top-0 z-[3] flex items-center justify-between p-4">
          <div className="flex items-center gap-2.5">
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide text-white"
              style={{ background: "rgba(226,59,84,.92)" }}
            >
              <span className="inline-block h-[7px] w-[7px] animate-df-pulse rounded-full bg-white" />
              {label}
            </span>
            <span className="ff-mono rounded-lg bg-white/10 px-2.5 py-1 text-[14px] font-semibold text-white">
              {timer}
            </span>
          </div>
          <button
            type="button"
            onClick={onMinimize}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/20 bg-white/10 text-white hover:bg-white/20"
            aria-label="Minimizar"
            title="Minimizar"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        <div
          className="relative flex flex-1 items-center justify-center"
          style={{ background: "radial-gradient(120% 120% at 50% 30%, rgba(40,194,226,.22) 0%, #0a1626 70%)" }}
        >
          {/* El <video> remoto siempre existe en el DOM. Lo escondemos cuando
              no hay video remoto y mostramos el avatar grande encima. */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            style={{ display: remoteHasVideo ? "block" : "none" }}
            aria-label="Video del interlocutor"
          />
          {!remoteHasVideo && (
            <div className="flex flex-col items-center gap-4">
              <div
                className="flex h-[160px] w-[160px] items-center justify-center rounded-full text-[58px] font-bold text-white shadow-2xl"
                style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
                aria-hidden
              >
                {initials(remote)}
              </div>
              <div className="text-center">
                <div className="ff-display text-[22px] font-bold text-white">{remote}</div>
                <div className="mt-1 text-[13px] text-[#7e93ad]">
                  {state.call === "on-hold"
                    ? "En espera"
                    : state.muted
                      ? "Conectado · micrófono silenciado"
                      : state.videoEnabled
                        ? "Conectado · tu cámara activa, esperando video del otro lado"
                        : "Conectado · solo audio"}
                </div>
              </div>
            </div>
          )}

          {localHasVideo && (
            <div
              className="absolute bottom-4 right-4 z-[2] flex h-28 w-44 items-center justify-center overflow-hidden rounded-[13px] border-2 border-white/20 shadow-xl"
              style={{ background: "linear-gradient(140deg,#0f3056,#1a6f8a)" }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                aria-label="Tu cámara"
              />
              <span className="absolute bottom-1.5 left-2 text-[10.5px] font-semibold text-white drop-shadow">
                Vos
              </span>
            </div>
          )}

          <span
            className="absolute left-4 bottom-4 z-[2] flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-[12.5px] font-semibold text-white"
            aria-hidden
          >
            <span className="inline-block h-2 w-2 animate-df-pulse rounded-full" style={{ background: "#22c55e" }} />
            {remote}
          </span>
        </div>

        <div
          className="flex flex-none items-center justify-center gap-3 border-t p-4"
          style={{ background: "#08121f", borderColor: "#16263d" }}
        >
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-white"
            style={{ background: state.muted ? "hsl(var(--df-hang))" : "rgba(255,255,255,.1)" }}
            aria-label={state.muted ? "Quitar silencio" : "Silenciar"}
            title={state.muted ? "Quitar silencio" : "Silenciar"}
          >
            {state.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleVideo()}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-white"
            style={{ background: state.videoEnabled ? "rgba(40,194,226,.32)" : "rgba(255,255,255,.1)" }}
            aria-label={state.videoEnabled ? "Apagar cámara" : "Activar cámara"}
            title={state.videoEnabled ? "Apagar cámara" : "Activar cámara"}
          >
            {state.videoEnabled ? <Camera className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/10 text-[#dce6f2] hover:bg-white/20"
            aria-label="Compartir pantalla"
            title="Compartir pantalla (próximamente)"
            disabled
          >
            <Monitor className="h-5 w-5 opacity-60" />
          </button>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-white">
            <Volume2 className="h-4 w-4" />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setVolume(v);
                const a = document.querySelector<HTMLAudioElement>("audio[data-df-remote='1']");
                if (a) a.volume = v / 100;
              }}
              aria-label="Volumen"
              className="h-1 w-28 accent-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void hangup()}
            className="flex h-[52px] items-center gap-2 rounded-full px-7 text-[15px] font-bold text-white hover:brightness-110"
            style={{ background: "hsl(var(--df-hang))" }}
            aria-label="Finalizar llamada"
          >
            <Phone className="h-5 w-5 rotate-[135deg]" aria-hidden />
            Finalizar
          </button>
        </div>
      </div>
    </div>
  );
}

function initials(name: string): string {
  if (!name) return "?";
  return name
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

// Silence the unused-import warning in dev for VideoOff used only conditionally.
void VideoOff;
