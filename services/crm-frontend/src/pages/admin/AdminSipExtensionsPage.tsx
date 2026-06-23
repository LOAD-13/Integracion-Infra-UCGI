import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createSipExtension,
  deleteSipExtension,
  listSipExtensions,
  updateSipExtension,
  type SipExtension,
  type SipExtensionCreatePayload,
} from "@/api/sipExtensions";
import { listUsers, type UserSummary } from "@/api/users";
import { useToast } from "@/components/toast/useToast";

export function AdminSipExtensionsPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const [exts, setExts] = useState<SipExtension[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [e, u] = await Promise.all([listSipExtensions(session.token), listUsers(session.token)]);
      setExts(e); setUsers(u);
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(payload: SipExtensionCreatePayload) {
    if (!session) return;
    try {
      await createSipExtension(session.token, payload);
      push({ title: "Extensión creada", desc: "Se está propagando a MikoPBX", kind: "ok" });
      setCreating(false);
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleToggle(ext: SipExtension) {
    if (!session) return;
    try {
      await updateSipExtension(session.token, ext.id, { enabled: !ext.enabled });
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleDelete(ext: SipExtension) {
    if (!session) return;
    if (!window.confirm(`¿Eliminar extensión ${ext.extensionNumber}?`)) return;
    try {
      await deleteSipExtension(session.token, ext.id);
      push({ title: "Extensión eliminada", kind: "ok" });
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  const enabled = exts.filter((e) => e.enabled).length;
  const manualOk = exts.filter((e) => e.manualAttributesApplied).length;

  return (
    <div className="flex flex-col gap-4 animate-df-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3">
          <Stat label="Total" value={String(exts.length)} />
          <Stat label="Habilitadas" value={String(enabled)} />
          <Stat label="Con manualAttrs" value={String(manualOk)} />
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-10 items-center gap-1.5 rounded-[10px] border-0 bg-df-navy px-4 text-[13.5px] font-bold text-white hover:brightness-110"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva extensión
        </button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
        <div
          className="grid gap-2 border-b border-df-border px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-df-text-dim"
          style={{ gridTemplateColumns: "1fr 1.5fr 1fr 1.2fr 100px" }}
        >
          <span>Ext</span><span>Usuario</span><span>Estado</span><span>Manual attrs</span><span className="text-right">Acciones</span>
        </div>
        {loading && <div className="px-5 py-8 text-center text-[13px] text-df-text-muted">Cargando…</div>}
        {!loading && exts.map((ext) => (
          <div key={ext.id} className="grid gap-2 border-b border-df-border px-5 py-3"
            style={{ gridTemplateColumns: "1fr 1.5fr 1fr 1.2fr 100px", alignItems: "center" }}>
            <span className="ff-mono text-[14px] font-bold text-df-text">{ext.extensionNumber}</span>
            <span className="text-[12.5px] text-df-text-muted">{ext.username}</span>
            <button type="button" onClick={() => handleToggle(ext)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold w-fit"
              style={{ background: ext.enabled ? "hsl(var(--df-call) / 0.13)" : "hsl(var(--df-st-offline) / 0.15)", color: ext.enabled ? "hsl(var(--df-call))" : "hsl(var(--df-st-offline))" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: "currentColor" }} />
              {ext.enabled ? "Habilitada" : "Deshabilitada"}
            </button>
            <span className="text-[12px] font-semibold w-fit rounded-md px-2 py-0.5"
              style={ext.manualAttributesApplied
                ? { background: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" }
                : { background: "hsl(var(--df-surface-3))", color: "hsl(var(--df-text-muted))" }}>
              {ext.manualAttributesApplied ? "webrtc ON" : "default"}
            </span>
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => handleDelete(ext)} aria-label={`Eliminar ${ext.extensionNumber}`}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border text-df-text-muted hover:text-df-hang">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <CreateDialog
          users={users.filter((u) => !exts.some((e) => e.userId === u.id))}
          onClose={() => setCreating(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
}

void Pencil;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-df-border bg-df-surface px-4 py-3 shadow-[0_1px_2px_rgba(13,37,66,.04)]">
      <div className="text-[11.5px] font-semibold text-df-text-muted">{label}</div>
      <div className="ff-display mt-0.5 text-[23px] font-bold text-df-text">{value}</div>
    </div>
  );
}

function CreateDialog({ users, onClose, onSave }: { users: UserSummary[]; onClose: () => void; onSave: (p: SipExtensionCreatePayload) => Promise<void> | void }) {
  const [username, setUsername] = useState(users[0]?.username ?? "");
  const [extNum, setExtNum] = useState("");
  const [password, setPassword] = useState(generatePass());

  return (
    <div className="fixed inset-0 z-[50] flex animate-df-fade items-center justify-center p-4" style={{ background: "rgba(8,18,32,.5)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[480px] max-w-[92vw] animate-df-in overflow-hidden rounded-[15px] border border-df-border-strong bg-df-surface shadow-[0_14px_40px_rgba(13,37,66,.16)]">
        <div className="border-b border-df-border px-5 py-4">
          <div className="ff-display text-[16px] font-bold text-df-text">Nueva extensión SIP</div>
          <div className="mt-1 text-[12.5px] text-df-text-dim">Se aplican manualattributes con WebRTC habilitado automáticamente.</div>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-df-text-muted">Usuario</label>
            <select value={username} onChange={(e) => setUsername(e.target.value)}
              className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand">
              {users.map((u) => <option key={u.id} value={u.username}>{u.username} · {u.fullName}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-df-text-muted">Número de extensión</label>
            <input value={extNum} onChange={(e) => setExtNum(e.target.value)} placeholder="Ej: 1003" className="ff-mono h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-df-text-muted">Secret SIP</label>
            <div className="flex gap-2">
              <input value={password} onChange={(e) => setPassword(e.target.value)} className="ff-mono h-10 flex-1 rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
              <button type="button" onClick={() => setPassword(generatePass())} className="h-10 rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[12.5px] font-semibold text-df-text-muted hover:text-df-text">Regenerar</button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-df-border px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-[10px] border border-df-border bg-transparent px-4 text-[13px] font-semibold text-df-text-muted">Cancelar</button>
          <button type="button" disabled={!username || !extNum || password.length < 6} onClick={() => void onSave({ username, extensionNumber: extNum, password })}
            className="h-10 rounded-[10px] border-0 bg-df-navy px-4 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-60">Crear</button>
        </div>
      </div>
    </div>
  );
}

function generatePass(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
