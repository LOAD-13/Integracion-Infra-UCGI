import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ApiError, login } from "@/api/client";
import { AuthContext, type AuthSession } from "./auth-context";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await login({ username, password });
      setSession({
        token: response.accessToken,
        username: response.username,
        role: response.role,
      });
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
  }, []);

  const value = useMemo(
    () => ({ session, loading, error, signIn, signOut }),
    [session, loading, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
