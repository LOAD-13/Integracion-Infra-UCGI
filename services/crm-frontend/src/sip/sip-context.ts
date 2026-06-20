import { createContext } from "react";
import type { SipState } from "./sip-types";

export interface SipContextValue {
  state: SipState;
  call: (target: string) => Promise<void>;
  answer: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleHold: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export const SipContext = createContext<SipContextValue | undefined>(undefined);
