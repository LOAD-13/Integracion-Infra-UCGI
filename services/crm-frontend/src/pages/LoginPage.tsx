import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";

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
    <div className="flex h-full min-h-screen">
      {/* Brand panel */}
      <div
        className="df-rail-bg relative hidden flex-1 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ flex: "1.05" }}
      >
        <div
          className="absolute -right-32 -top-32 h-[440px] w-[440px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(40,194,226,.18), transparent 70%)" }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-white p-1.5">
            <img src="/dialflow-icon.png" alt="" className="block h-full w-full object-contain" />
          </div>
          <span className="ff-display text-[23px] font-bold tracking-tight text-white">
            Dial<span style={{ color: "hsl(var(--df-brand-bright))" }}>Flow</span>
          </span>
        </div>
        <div className="relative max-w-[430px]">
          <h1 className="ff-display text-[33px] font-bold leading-tight tracking-tight text-white">
            El centro de operación de tu call center.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-df-rail-text">
            Atendé llamadas, gestioná clientes y seguí tus métricas — todo en una sola pantalla,
            pensada para turnos largos.
          </p>
        </div>
        <div className="relative flex flex-wrap gap-6 text-[12.5px] font-semibold text-df-rail-text">
          {["Softphone integrado", "Videollamadas", "Métricas en vivo"].map((f) => (
            <span key={f} className="flex items-center gap-2">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "hsl(var(--df-brand-bright))" }}
              />
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-df-surface p-8">
        <div className="w-[362px] max-w-full">
          <h1 className="ff-display text-[24px] font-bold text-df-text">DialFlow · CRM</h1>
          <div className="mt-1.5 mb-7 text-[13.5px] text-df-text-muted">
            Ingresá con tu usuario para acceder al panel.
          </div>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-[12px] font-bold text-df-text-muted">
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                disabled={loading}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-label="Usuario"
                className="h-11 w-full rounded-[11px] border border-df-border bg-df-surface-2 px-3.5 text-[14px] text-df-text outline-none focus:border-df-brand focus:shadow-[0_0_0_3px_hsl(var(--df-brand)/0.42)]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[12px] font-bold text-df-text-muted">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Contraseña"
                className="h-11 w-full rounded-[11px] border border-df-border bg-df-surface-2 px-3.5 text-[14px] text-df-text outline-none focus:border-df-brand focus:shadow-[0_0_0_3px_hsl(var(--df-brand)/0.42)]"
              />
            </div>
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-md border border-df-hang/40 bg-df-hang-soft px-3 py-2 text-sm"
                style={{ color: "hsl(var(--df-hang))" }}
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border-0 bg-df-navy text-[14.5px] font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Ingresando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </form>
          <div className="mt-5 rounded-[10px] border border-df-border bg-df-surface-2 px-3 py-2.5 text-[12px] text-df-text-muted">
            La sesión se guarda solo en memoria — al refrescar el navegador tendrás que ingresar de nuevo.
          </div>
        </div>
      </div>
    </div>
  );
}
