import { Navigate, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "@/auth/useAuth";

interface ProtectedRouteProps {
  children: ReactElement;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
