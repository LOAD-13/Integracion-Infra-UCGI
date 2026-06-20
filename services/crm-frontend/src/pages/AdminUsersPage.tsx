import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createUser,
  deleteUser,
  listUsers,
  updateUserRole,
  type CreateUserPayload,
  type UserSummary,
} from "@/api/users";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AdminUsersPage() {
  const { session } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      setUsers(await listUsers(session.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al listar usuarios");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(payload: CreateUserPayload) {
    if (!session) return;
    await createUser(session.token, payload);
    await load();
  }

  async function handleRoleChange(user: UserSummary, role: "ADMIN" | "AGENTE") {
    if (!session) return;
    if (role === user.role) return;
    setError(null);
    try {
      await updateUserRole(session.token, user.id, role);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar el rol");
    }
  }

  async function handleDelete(user: UserSummary) {
    if (!session) return;
    if (!window.confirm(`¿Dar de baja a ${user.username}?`)) return;
    try {
      await deleteUser(session.token, user.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <div className="container space-y-6 py-10">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/">
          <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
          Volver al panel
        </Link>
      </Button>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Administración de usuarios
          </h1>
          <p className="text-sm text-muted-foreground">
            Alta, edición de rol y baja. Solo accesible para administradores.
          </p>
        </div>
        <CreateUserDialog onCreate={handleCreate} />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usuarios</CardTitle>
          <CardDescription>
            {loading ? "Cargando…" : `${users.length} usuarios registrados`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.username}</div>
                    <p className="text-xs text-muted-foreground">
                      {user.fullName}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <select
                      aria-label={`Rol de ${user.username}`}
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(
                          user,
                          e.target.value as "ADMIN" | "AGENTE",
                        )
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      data-testid={`role-select-${user.username}`}
                    >
                      <option value="AGENTE">AGENTE</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <Badge variant="success">Activo</Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(user)}
                      aria-label={`Dar de baja a ${user.username}`}
                    >
                      <Trash2
                        aria-hidden="true"
                        className="h-4 w-4 text-destructive"
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
