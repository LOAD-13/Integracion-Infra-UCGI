import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, login, registerUnauthorizedHandler } from "@/api/client";
import { AuthContext, type AuthSession } from "./auth-context";

const STORAGE_KEY = "df_session";

function readStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!parsed.token || !parsed.username || !parsed.role) return null;
    return { token: parsed.token, username: parsed.username, role: parsed.role };
  } catch {
    return null;
  }
}

function writeStoredSession(session: AuthSession | null) {
  try {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // QuotaExceeded o storage deshabilitado: no rompemos el flujo.
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await login({ username, password });
      const next: AuthSession = {
        token: response.accessToken,
        username: response.username,
        role: response.role,
        mustChangePassword: response.mustChangePassword === true,
      };
      setSession(next);
      writeStoredSession(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Usuario o contraseña incorrectos");
      } else if (err instanceof Error) {
        setError(err.message || "Error de autenticación");
      } else {
        setError("Error de autenticación");
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    setError(null);
    writeStoredSession(null);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, mustChangePassword: false };
      writeStoredSession(next);
      return next;
    });
  }, []);

  // Cuando el backend rechaza el token (expirado / inválido), el cliente HTTP
  // notifica acá y limpiamos la sesión para forzar nuevo login.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setSession(null);
      writeStoredSession(null);
    });
    return () => registerUnauthorizedHandler(null);
  }, []);

  // Sincronización entre pestañas: si en otra tab cierran sesión, esta también.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setSession(readStoredSession());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ session, loading, error, signIn, signOut, clearMustChangePassword }),
    [session, loading, error, signIn, signOut, clearMustChangePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
