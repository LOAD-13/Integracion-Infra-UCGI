import { Link } from "react-router-dom";
import { LogOut, Users } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { Softphone } from "@/components/softphone/Softphone";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DashboardPage() {
  const { session, signOut } = useAuth();

  return (
    <div className="container space-y-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Panel del agente
          </h1>
          <p className="text-sm text-muted-foreground">
            Bienvenido, {session?.username} · rol{" "}
            <span className="font-medium text-foreground">{session?.role}</span>
          </p>
        </div>
        <Button variant="outline" onClick={signOut}>
          <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Próximamente</CardTitle>
            <CardDescription>
              Las siguientes HU del Sprint 3 (HU-04.3 a HU-04.9) van a poblar
              este panel con el CRUD de clientes, el histórico de llamadas,
              las notas y los KPIs del agente.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
            <Link
              to="/clients"
              className="rounded-md border bg-primary/5 p-4 transition-colors hover:bg-primary/10"
            >
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Users aria-hidden="true" className="h-4 w-4" />
                Clientes
              </p>
              <p>Listado, alta, edición y baja de la cartera.</p>
            </Link>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="font-medium text-foreground">Histórico CDR</p>
              <p>Pendiente HU-04.5.</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="font-medium text-foreground">Notas</p>
              <p>Pendiente HU-04.6 (autosave).</p>
            </div>
            <div className="rounded-md border bg-muted/20 p-4">
              <p className="font-medium text-foreground">KPIs del día</p>
              <p>Pendiente HU-04.7.</p>
            </div>
          </CardContent>
        </Card>

        <Softphone />
      </div>
    </div>
  );
}
