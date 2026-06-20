import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Play,
  Video,
  VideoOff,
} from "lucide-react";
import { useSip } from "@/sip/useSip";
import type { CallState, RegistrationState } from "@/sip/sip-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const REGISTRATION_LABEL: Record<RegistrationState, string> = {
  idle: "Inactivo",
  connecting: "Conectando…",
  registered: "Registrado",
  unregistered: "Desconectado",
  failed: "Error",
};

const CALL_LABEL: Record<CallState, string> = {
  idle: "Sin llamada",
  outgoing: "Llamando…",
  incoming: "Llamada entrante",
  connected: "En llamada",
  "on-hold": "En espera",
};

export function Softphone() {
  const {
    state,
    call,
    answer,
    hangup,
    toggleMute,
    toggleHold,
    toggleVideo,
    localStream,
    remoteStream,
  } = useSip();
  const [target, setTarget] = useState("");
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream ?? null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream ?? null;
    }
  }, [remoteStream]);

  const inCall = state.call === "connected" || state.call === "on-hold";
  const isIncoming = state.call === "incoming";
  const isOutgoing = state.call === "outgoing";
  const canDial = state.registration === "registered" && state.call === "idle";

  async function handleDial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = target.trim();
    if (!cleaned || !canDial) return;
    try {
      await call(cleaned);
    } catch (err) {
      // Errores transitorios — la UI los ignora; el estado del SipClient
      // reflejará el cuelgue cuando llegue.
      console.warn("Error al llamar:", err);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Softphone</CardTitle>
            <CardDescription>
              Llamadas internas entre agentes vía WebRTC sobre MikoPBX.
            </CardDescription>
          </div>
          <RegistrationBadge state={state.registration} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <p className="font-medium" data-testid="call-status">
            {CALL_LABEL[state.call]}
          </p>
          {state.remoteIdentity && (
            <p className="text-muted-foreground" data-testid="remote-identity">
              {isIncoming ? "Entrante de " : "Con "}
              {state.remoteIdentity}
            </p>
          )}
          {state.errorMessage && (
            <p
              role="alert"
              className="mt-1 text-destructive"
              data-testid="sip-error"
            >
              {state.errorMessage}
            </p>
          )}
        </div>

        <form onSubmit={handleDial} className="space-y-2" noValidate>
          <Label htmlFor="dial-target">Marcar</Label>
          <div className="flex gap-2">
            <Input
              id="dial-target"
              name="dial-target"
              type="text"
              inputMode="tel"
              placeholder="1001, 9XXX, *97…"
              autoComplete="off"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={!canDial && !isIncoming}
            />
            <Button
              type="submit"
              disabled={!canDial}
              aria-label="Llamar al destino"
            >
              <Phone aria-hidden="true" className="mr-1 h-4 w-4" />
              Llamar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Campo libre — admite extensiones internas y prefijos de salida
            (HU-09.7 SIP Trunk).
          </p>
        </form>

        {!state.cameraAvailable && (
          <p
            role="alert"
            className="text-xs text-destructive"
            data-testid="camera-warning"
          >
            La cámara no está disponible — el softphone seguirá funcionando en modo
            solo-audio.
          </p>
        )}

        {(state.videoEnabled || remoteStream) && (
          <div className="grid gap-2 sm:grid-cols-2" data-testid="video-surfaces">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="aspect-video w-full rounded-md bg-black object-cover"
              aria-label="Video remoto del interlocutor"
              data-testid="remote-video"
            />
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full rounded-md bg-black object-cover"
              aria-label="Tu propio video (cámara local)"
              data-testid="local-video"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {isIncoming && (
            <Button
              variant="default"
              onClick={() => answer()}
              aria-label="Contestar llamada"
            >
              <PhoneIncoming aria-hidden="true" className="mr-1 h-4 w-4" />
              Contestar
            </Button>
          )}
          {(inCall || isOutgoing || isIncoming) && (
            <Button
              variant="destructive"
              onClick={() => hangup()}
              aria-label={isIncoming ? "Rechazar llamada" : "Colgar"}
            >
              {isIncoming ? (
                <>
                  <PhoneMissed aria-hidden="true" className="mr-1 h-4 w-4" />
                  Rechazar
                </>
              ) : (
                <>
                  <PhoneOff aria-hidden="true" className="mr-1 h-4 w-4" />
                  Colgar
                </>
              )}
            </Button>
          )}
          {state.call === "idle" && state.registration === "registered" && (
            <Button
              variant="outline"
              onClick={() => toggleVideo()}
              aria-pressed={state.videoEnabled}
              aria-label={
                state.videoEnabled
                  ? "Desactivar video para próximas llamadas"
                  : "Activar video para próximas llamadas"
              }
            >
              {state.videoEnabled ? (
                <>
                  <VideoOff aria-hidden="true" className="mr-1 h-4 w-4" />
                  Video activo
                </>
              ) : (
                <>
                  <Video aria-hidden="true" className="mr-1 h-4 w-4" />
                  Activar video
                </>
              )}
            </Button>
          )}
          {inCall && (
            <>
              <Button
                variant="outline"
                onClick={() => toggleMute()}
                aria-pressed={state.muted}
                aria-label={state.muted ? "Quitar silencio" : "Silenciar micrófono"}
              >
                {state.muted ? (
                  <>
                    <MicOff aria-hidden="true" className="mr-1 h-4 w-4" />
                    Silenciado
                  </>
                ) : (
                  <>
                    <Mic aria-hidden="true" className="mr-1 h-4 w-4" />
                    Silenciar
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => toggleHold()}
                aria-pressed={state.call === "on-hold"}
                aria-label={
                  state.call === "on-hold"
                    ? "Reanudar llamada"
                    : "Poner llamada en espera"
                }
              >
                {state.call === "on-hold" ? (
                  <>
                    <Play aria-hidden="true" className="mr-1 h-4 w-4" />
                    Reanudar
                  </>
                ) : (
                  <>
                    <Pause aria-hidden="true" className="mr-1 h-4 w-4" />
                    En espera
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RegistrationBadge({ state }: { state: RegistrationState }) {
  const color =
    state === "registered"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : state === "failed" || state === "unregistered"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <span
      data-testid="registration-badge"
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${color}`}
    >
      <span
        aria-hidden="true"
        className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
          state === "registered"
            ? "bg-emerald-500"
            : state === "failed" || state === "unregistered"
              ? "bg-destructive"
              : "bg-muted-foreground"
        }`}
      />
      {REGISTRATION_LABEL[state]}
    </span>
  );
}
