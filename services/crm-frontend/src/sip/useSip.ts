import { useContext } from "react";
import { SipContext, type SipContextValue } from "./sip-context";

export function useSip(): SipContextValue {
  const ctx = useContext(SipContext);
  if (!ctx) {
    throw new Error("useSip debe usarse dentro de un SipProvider");
  }
  return ctx;
}
