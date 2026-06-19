import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authorizedFetch } from "@/api/client";
import { useAuth } from "@/auth/useAuth";
import { SipClient } from "./SipClient";
import { SipContext } from "./sip-context";
import {
  INITIAL_STATE,
  type SipConfig,
  type SipCredentials,
  type SipState,
} from "./sip-types";

interface SipProviderProps {
  children: ReactNode;
  /**
   * Inyectable para tests: permite reemplazar la creación del SipClient.
   * En producción se usa el default basado en `sip.js`.
   */
  clientFactory?: (config: SipConfig) => SipClient;
}

const DEFAULT_FACTORY = (config: SipConfig) => new SipClient(config);

export function SipProvider({
  children,
  clientFactory = DEFAULT_FACTORY,
}: SipProviderProps) {
  const { session } = useAuth();
  const [state, setState] = useState<SipState>(INITIAL_STATE);
  const clientRef = useRef<SipClient | null>(null);

  const resetState = useCallback(
    (patch: Partial<SipState> = {}) =>
      setState({ ...INITIAL_STATE, ...patch }),
    [],
  );

  useEffect(() => {
    if (!session) {
      clientRef.current?.disconnect();
      clientRef.current = null;
      resetState();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const credentials = await fetchCredentials(session.token);
        if (cancelled) return;
        const client = clientFactory({
          credentials,
          wsUrl: import.meta.env.VITE_SIP_WS_URL,
          domain: import.meta.env.VITE_SIP_DOMAIN,
        });
        client.onStateChange((next) => setState(next));
        clientRef.current = client;
        await client.connect();
      } catch (err) {
        if (cancelled) return;
        resetState({
          registration: "failed",
          errorMessage:
            err instanceof Error
              ? err.message
              : "No se pudo iniciar el softphone",
        });
      }
    })();

    return () => {
      cancelled = true;
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, [session, clientFactory, resetState]);

  const call = useCallback(async (target: string) => {
    await clientRef.current?.call(target);
  }, []);

  const answer = useCallback(async () => {
    await clientRef.current?.answer();
  }, []);

  const hangup = useCallback(async () => {
    await clientRef.current?.hangup();
  }, []);

  const toggleMute = useCallback(() => {
    clientRef.current?.toggleMute();
  }, []);

  const toggleHold = useCallback(async () => {
    await clientRef.current?.toggleHold();
  }, []);

  const value = useMemo(
    () => ({ state, call, answer, hangup, toggleMute, toggleHold }),
    [state, call, answer, hangup, toggleMute, toggleHold],
  );

  return <SipContext.Provider value={value}>{children}</SipContext.Provider>;
}

async function fetchCredentials(token: string): Promise<SipCredentials> {
  const response = await authorizedFetch(token, "/v1/me/sip-credentials");
  if (response.status === 404) {
    throw new Error("Sin extensión SIP asignada");
  }
  if (!response.ok) {
    throw new Error("No se pudieron obtener las credenciales SIP");
  }
  return (await response.json()) as SipCredentials;
}
