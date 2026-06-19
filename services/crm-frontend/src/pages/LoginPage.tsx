import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, PhoneCall } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginPage() {
  const { session, signIn, loading, error } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await signIn(username, password);
      navigate("/", { replace: true });
    } catch {
      // El estado de error ya lo gestiona el contexto.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PhoneCall aria-hidden="true" className="h-6 w-6" />
          </div>
          <CardTitle>UCGI · CRM</CardTitle>
          <CardDescription>
            Iniciá sesión con tu cuenta corporativa para acceder al panel del
            agente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                disabled={loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && (
                <Loader2
                  aria-hidden="true"
                  className="mr-2 h-4 w-4 animate-spin"
                />
              )}
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            La sesión se guarda solo en memoria — al refrescar el navegador
            tendrás que ingresar de nuevo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
