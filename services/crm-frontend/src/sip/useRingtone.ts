import { useEffect, useRef } from "react";
import type { SipState } from "./sip-types";

const RING_FREQS_HZ = [440, 480] as const;
const RING_ON_SECONDS = 2;
const RING_PERIOD_MS = 6000;
const RING_GAIN_PEAK = 0.25;

/**
 * Reproduce el cadencia clásica de timbre de teléfono (440+480 Hz, 2s on / 4s off)
 * mientras `callState === "incoming"`. Usa Web Audio API sin assets binarios.
 *
 * El contexto se resume al primer use; algunos browsers crean el AudioContext
 * en estado `suspended` hasta que hay un gesto del usuario. En la práctica el
 * agente ya interactuó con la UI antes de recibir una llamada, así que el
 * `resume()` pasa en seguida.
 */
export function useRingtone(callState: SipState["call"]): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (callState !== "incoming") {
      stopRing(ctxRef, intervalRef);
      return;
    }
    startRing(ctxRef, intervalRef);
    return () => stopRing(ctxRef, intervalRef);
  }, [callState]);
}

function startRing(
  ctxRef: React.MutableRefObject<AudioContext | null>,
  intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  const AudioCtor =
    window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtor) return;

  const ctx = new AudioCtor();
  ctxRef.current = ctx;
  void ctx.resume();

  const playPulse = () => {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(RING_GAIN_PEAK, now + 0.05);
    gain.gain.setValueAtTime(RING_GAIN_PEAK, now + RING_ON_SECONDS - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + RING_ON_SECONDS);
    gain.connect(ctx.destination);

    for (const freq of RING_FREQS_HZ) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + RING_ON_SECONDS);
    }
  };

  playPulse();
  intervalRef.current = setInterval(playPulse, RING_PERIOD_MS);
}

function stopRing(
  ctxRef: React.MutableRefObject<AudioContext | null>,
  intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
): void {
  if (intervalRef.current !== null) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
  if (ctxRef.current) {
    void ctxRef.current.close();
    ctxRef.current = null;
  }
}
