import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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

  useEffect(() => { load(); }, [load]);

  async function handleCreate(payload: CreateUserPayload): Promise<UserSummary> {
    if (!session) throw new Error("Sin sesión");
    const created = await createUser(session.token, payload);
    await load();
    return created;
  }

  async function handleRoleChange(user: UserSummary, role: "ADMIN" | "AGENTE") {
    if (!session || role === user.role) return;
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

  const admins = users.filter((u) => u.role === "ADMIN").length;
  const agents = users.filter((u) => u.role === "AGENTE" && u.active).length;

  return (
    <div className="flex flex-col gap-4 animate-df-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3.5">
          <Stat label="Usuarios totales" value={String(users.length)} />
          <Stat label="Agentes activos" value={String(agents)} />
          <Stat label="Administradores" value={String(admins)} />
        </div>
        <CreateUserDialog onCreate={handleCreate} />
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "hsl(var(--df-hang))" }}>{error}</p>
      )}

      <div className="overflow-hidden rounded-[14px] border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
        <div
          className="grid gap-2 border-b border-df-border px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-df-text-dim"
          style={{ gridTemplateColumns: "2fr 1.4fr 1fr 1fr 100px" }}
        >
          <span>Usuario</span>
          <span>Email</span>
          <span>Rol</span>
          <span>Estado</span>
          <span className="text-right">Acciones</span>
        </div>
        {loading && (
          <div className="px-5 py-8 text-center text-[13px] text-df-text-muted">Cargando…</div>
        )}
        {!loading && users.map((user) => (
          <div
            key={user.id}
            className="grid gap-2 border-b border-df-border px-5 py-3"
            style={{ gridTemplateColumns: "2fr 1.4fr 1fr 1fr 100px", alignItems: "center" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12.5px] font-bold text-white"
                style={{ background: "linear-gradient(140deg,#0f3056,#28c2e2)" }}
                aria-hidden
              >
                {initials(user.username)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-bold text-df-text">{user.username}</div>
                <div className="truncate text-[11.5px] text-df-text-dim">{user.fullName}</div>
              </div>
            </div>
            <span className="truncate text-[12.5px] text-df-text-muted">{user.email}</span>
            <span>
              <select
                aria-label={`Rol de ${user.username}`}
                value={user.role}
                onChange={(e) => handleRoleChange(user, e.target.value as "ADMIN" | "AGENTE")}
                data-testid={`role-select-${user.username}`}
                className="h-8 rounded-md border border-df-border bg-df-surface-2 px-2 text-[12.5px] font-semibold text-df-text"
              >
                <option value="AGENTE">AGENTE</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </span>
            <UserStatusCell user={user} />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => handleDelete(user)}
                title="Dar de baja"
                aria-label={`Dar de baja a ${user.username}`}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border bg-transparent text-df-text-muted hover:text-df-hang"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const AGENT_STATUS_META: Record<string, { label: string; color: string }> = {
  AVAILABLE: { label: "Disponible", color: "hsl(var(--df-st-available))" },
  BREAK: { label: "En descanso", color: "hsl(var(--df-st-break))" },
  BUSY: { label: "Ocupado", color: "hsl(var(--df-st-busy))" },
  DND: { label: "No molestar", color: "hsl(var(--df-st-dnd))" },
  OFFLINE: { label: "Desconectado", color: "hsl(var(--df-st-offline))" },
};

function UserStatusCell({ user }: { user: UserSummary }) {
  if (!user.active) {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-df-text-muted">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(var(--df-st-offline))" }} />
        Dado de baja
      </span>
    );
  }
  if (user.role === "ADMIN") {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-df-text-muted">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: "hsl(var(--df-navy))" }} />
        Administrador
      </span>
    );
  }
  const meta = AGENT_STATUS_META[user.agentStatus ?? "OFFLINE"] ?? AGENT_STATUS_META.OFFLINE;
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-df-text-muted">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-df-border bg-df-surface px-4 py-3 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
      <div className="text-[11.5px] font-semibold text-df-text-muted">{label}</div>
      <div className="ff-display mt-0.5 text-[23px] font-bold text-df-text">{value}</div>
    </div>
  );
}

function initials(s: string): string {
  return s.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}
