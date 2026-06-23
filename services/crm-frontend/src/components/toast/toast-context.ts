import { createContext } from "react";

export type ToastKind = "ok" | "info" | "warn" | "end";

export interface Toast {
  id: number;
  title: string;
  desc?: string;
  kind: ToastKind;
}

export interface ToastContextValue {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
