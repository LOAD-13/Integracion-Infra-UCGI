import { Navigate, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "@/auth/useAuth";

interface ProtectedRouteProps {
  children: ReactElement;
  /** Si se especifica, exige que la sesión tenga uno de estos roles. */
  roles?: Array<"ADMIN" | "AGENTE">;
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(session.role as "ADMIN" | "AGENTE")) {
    return <Navigate to="/" replace />;
  }

  return children;
}
