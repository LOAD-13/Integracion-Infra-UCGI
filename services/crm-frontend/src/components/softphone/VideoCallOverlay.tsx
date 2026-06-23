import { useEffect, useRef, useState } from "react";
import { Camera, Maximize2, Mic, MicOff, Minimize2, Monitor, Phone, VideoOff } from "lucide-react";
import { useSip } from "@/sip/useSip";

interface VideoCallOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function VideoCallOverlay({ open, onClose }: VideoCallOverlayProps) {
  const { state, hangup, toggleMute, toggleVideo, localStream, remoteStream } = useSip();
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [timer, setTimer] = useState("00:00");
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);

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

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream ?? null;
  }, [remoteStream]);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream ?? null;
  }, [localStream]);

  if (!open) return null;

  const remote = state.remoteIdentity ?? "Conectando…";

  return (
    <div
      className="fixed inset-0 z-[55] flex animate-df-fade items-center justify-center p-8"
      style={{ background: "rgba(6,14,26,.78)" }}
      role="dialog"
      aria-label="Videollamada en curso"
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
              EN VIDEOLLAMADA
            </span>
            <span className="ff-mono rounded-lg bg-white/10 px-2.5 py-1 text-[14px] font-semibold text-white">
              {timer}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/20 bg-white/10 text-white hover:bg-white/20"
            aria-label="Minimizar"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        </div>

        <div
          className="relative flex flex-1 items-center justify-center"
          style={{ background: "radial-gradient(120% 120% at 50% 30%, rgba(40,194,226,.22) 0%, #0a1626 70%)" }}
        >
          {remoteStream ? (
            <video
              ref={remoteRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
              aria-label="Video del interlocutor"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div
                className="flex h-[120px] w-[120px] items-center justify-center rounded-full text-[42px] font-bold text-white shadow-2xl"
                style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
                aria-hidden
              >
                {initials(remote)}
              </div>
              <div className="text-center">
                <div className="ff-display text-[20px] font-bold text-white">{remote}</div>
                <div className="mt-1 text-[13px] text-[#7e93ad]">
                  {state.videoEnabled ? "Conectado · video activo" : "Esperando video remoto…"}
                </div>
              </div>
            </div>
          )}

          <div
            className="absolute bottom-4 right-4 flex h-28 w-44 items-center justify-center overflow-hidden rounded-[13px] border-2 border-white/20 shadow-xl"
            style={{ background: "linear-gradient(140deg,#0f3056,#1a6f8a)" }}
          >
            {state.videoEnabled && localStream ? (
              <video
                ref={localRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                aria-label="Tu cámara"
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-white/50">
                <VideoOff className="h-5 w-5" />
                <span className="text-[10px]">Cámara off</span>
              </div>
            )}
            <span className="absolute bottom-1.5 left-2 text-[10.5px] font-semibold text-white drop-shadow">
              Vos
            </span>
          </div>
        </div>

        <div className="flex flex-none items-center justify-center gap-3 border-t p-4" style={{ background: "#08121f", borderColor: "#16263d" }}>
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-white"
            style={{ background: state.muted ? "hsl(var(--df-hang))" : "rgba(255,255,255,.1)" }}
            aria-label={state.muted ? "Quitar silencio" : "Silenciar"}
          >
            {state.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleVideo()}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-white"
            style={{ background: state.videoEnabled ? "rgba(255,255,255,.1)" : "hsl(var(--df-hang))" }}
            aria-label={state.videoEnabled ? "Apagar cámara" : "Activar cámara"}
          >
            {state.videoEnabled ? <Camera className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/10 text-[#dce6f2] hover:bg-white/20"
            aria-label="Compartir pantalla"
          >
            <Monitor className="h-5 w-5" />
          </button>
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

void Maximize2;

function initials(name: string): string {
  if (!name) return "?";
  return name.replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
