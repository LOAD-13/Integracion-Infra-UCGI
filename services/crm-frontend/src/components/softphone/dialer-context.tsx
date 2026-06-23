import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface DialerContextValue {
  open: boolean;
  openDialer: () => void;
  closeDialer: () => void;
}

const DialerContext = createContext<DialerContextValue | undefined>(undefined);

export function DialerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDialer = useCallback(() => setOpen(true), []);
  const closeDialer = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, openDialer, closeDialer }), [open, openDialer, closeDialer]);
  return <DialerContext.Provider value={value}>{children}</DialerContext.Provider>;
}

export function useDialer(): DialerContextValue {
  const ctx = useContext(DialerContext);
  if (!ctx) throw new Error("useDialer must be used within DialerProvider");
  return ctx;
}
