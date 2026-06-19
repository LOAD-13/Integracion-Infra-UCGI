export type RegistrationState =
  | "idle"
  | "connecting"
  | "registered"
  | "unregistered"
  | "failed";

export type CallState =
  | "idle"
  | "outgoing"
  | "incoming"
  | "connected"
  | "on-hold";

export interface SipState {
  registration: RegistrationState;
  call: CallState;
  remoteIdentity: string | null;
  errorMessage: string | null;
  muted: boolean;
}

export const INITIAL_STATE: SipState = {
  registration: "idle",
  call: "idle",
  remoteIdentity: null,
  errorMessage: null,
  muted: false,
};

export interface SipCredentials {
  extension: string;
  displayName: string;
  secret: string;
}

export interface SipConfig {
  credentials: SipCredentials;
  wsUrl: string;
  domain: string;
}
