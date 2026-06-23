import { createContext } from "react";

export interface AuthSession {
  token: string;
  username: string;
  role: string;
  mustChangePassword?: boolean;
}

export interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  clearMustChangePassword: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
