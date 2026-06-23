import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { changeOwnPassword } from "@/api/users";

/**
 * Modal bloqueante que se muestra al primer login del usuario provisionado.
 * Solo se cierra cuando la contraseña se cambia correctamente. No tiene
 * backdrop click ni botón cancelar — coherente con el modelo de gobernanza.
 */
export function ForcePasswordChange() {
  const { session, clearMustChangePassword, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) return null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (next === current) {
      setError("La nueva contraseña debe ser distinta a la actual.");
      return;
    }
    setBusy(true);
    try {
      await changeOwnPassword(session!.token, { currentPassword: current, newPassword: next });
      clearMustChangePassword();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9000] flex animate-df-fade items-center justify-center p-6"
      style={{ background: "rgba(8,18,32,.78)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Cambiar contraseña inicial"
    >
      <div className="w-[440px] max-w-full animate-df-pop rounded-2xl border border-df-border-strong bg-df-surface p-6 shadow-[0_30px_80px_rgba(0,0,0,.5)]">
        <div className="mb-3 flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" }}
          >
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <div className="ff-display text-[17px] font-bold text-df-text">Cambiá tu contraseña</div>
            <div className="text-[12.5px] text-df-text-muted">
              Es tu primer ingreso, midPoint te provisionó con una contraseña temporal.
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <PasswordField id="current" label="Contraseña actual (la temporal)" value={current} onChange={setCurrent} disabled={busy} autoComplete="current-password" />
          <PasswordField id="new" label="Nueva contraseña" value={next} onChange={setNext} disabled={busy} autoComplete="new-password" />
          <PasswordField id="confirm" label="Repetí la nueva contraseña" value={confirm} onChange={setConfirm} disabled={busy} autoComplete="new-password" />
          {error && (
            <div role="alert" className="rounded-md border px-3 py-2 text-[12.5px]"
                 style={{ borderColor: "hsl(var(--df-hang) / 0.5)", background: "hsl(var(--df-hang) / 0.08)", color: "hsl(var(--df-hang))" }}>
              {error}
            </div>
          )}
          <div className="flex justify-between pt-1">
            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="text-[12.5px] font-semibold text-df-text-muted hover:text-df-text"
            >
              Salir del CRM
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex h-10 items-center gap-2 rounded-[10px] border-0 bg-df-navy px-5 text-[13.5px] font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Guardar y entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  disabled,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[12px] font-bold text-df-text-muted">{label}</label>
      <input
        id={id}
        type="password"
        autoComplete={autoComplete}
        required
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-[11px] border border-df-border bg-df-surface-2 px-3.5 text-[14px] text-df-text outline-none focus:border-df-brand focus:shadow-[0_0_0_3px_hsl(var(--df-brand)/0.42)]"
      />
    </div>
  );
}
