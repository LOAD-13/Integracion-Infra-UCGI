import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createIvrOption,
  deleteIvrOption,
  getParkingConfig,
  listIvrOptions,
  updateParkingConfig,
  type ParkingAction,
  type ParkingConfig,
  type ParkingIvrOption,
} from "@/api/parking";
import { useToast } from "@/components/toast/useToast";

const ACTION_LABEL: Record<ParkingAction, string> = {
  CALLBACK: "Devolución de llamada",
  KEEP_WAITING: "Seguir esperando",
  HANGUP: "Colgar",
  TRANSFER_SKILL: "Transferir a skill",
};

// Archivos típicos del catálogo MikoPBX. El admin sube los suyos desde
// http://localhost:8090 → Telefonía → Archivos de sonido (o Música en espera).
const PRESET_GREETING_FILES: Array<{ label: string; value: string }> = [
  { label: "— Sin locución —", value: "" },
  { label: "Bienvenida estándar (es-ES)", value: "custom/welcome-es" },
  { label: "Aviso 'todos los agentes ocupados'", value: "custom/all-agents-busy-es" },
  { label: "Aviso 'fuera de horario'", value: "custom/out-of-hours-es" },
];

const PRESET_HOLD_MUSIC: Array<{ label: string; value: string }> = [
  { label: "— Sin música —", value: "" },
  { label: "The Calling — Angelwing", value: "moh/The_Calling_by_Angelwing.mp3" },
  { label: "The Nymphaeum part V — Angelwing", value: "moh/The_Nymphaeum_part_V_Angelwing.mp3" },
  { label: "Default MikoPBX", value: "default" },
];

export function AdminParkingPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const [config, setConfig] = useState<ParkingConfig | null>(null);
  const [options, setOptions] = useState<ParkingIvrOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAction, setNewAction] = useState<ParkingAction>("CALLBACK");

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [c, o] = await Promise.all([getParkingConfig(session.token), listIvrOptions(session.token)]);
      setConfig(c); setOptions(o);
    } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveConfig() {
    if (!session || !config) return;
    try {
      await updateParkingConfig(session.token, config);
      push({ title: "Configuración guardada", kind: "ok" });
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleAddOption() {
    if (!session || !newKey || !newLabel) return;
    try {
      await createIvrOption(session.token, {
        dtmfKey: newKey, label: newLabel, action: newAction, transferSkillId: null,
        position: options.length + 1,
      });
      setNewKey(""); setNewLabel(""); setNewAction("CALLBACK");
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  async function handleDeleteOption(id: number) {
    if (!session) return;
    try {
      await deleteIvrOption(session.token, id);
      await load();
    } catch (e) {
      push({ title: "Error", desc: (e as Error).message, kind: "warn" });
    }
  }

  if (loading || !config) return <p className="text-sm text-df-text-muted">Cargando…</p>;

  return (
    <div className="flex flex-col gap-5 animate-df-fade">
      <Section title="Configuración general">
        <div className="grid grid-cols-2 gap-4 p-5">
          <Field label="Loop seconds">
            <input type="number" min={5} value={config.loopSeconds}
              onChange={(e) => setConfig({ ...config, loopSeconds: parseInt(e.target.value, 10) || 0 })}
              className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
          </Field>
          <Field label="Timeout (segundos)">
            <input type="number" min={10} value={config.timeoutSeconds}
              onChange={(e) => setConfig({ ...config, timeoutSeconds: parseInt(e.target.value, 10) || 0 })}
              className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand" />
          </Field>
          <Field label="Locución inicial (archivo MikoPBX)">
            <MediaFileInput
              value={config.greetingUrl ?? ""}
              onChange={(v) => setConfig({ ...config, greetingUrl: v || null })}
              presets={PRESET_GREETING_FILES}
              placeholder="custom/welcome-es o https://..."
            />
          </Field>
          <Field label="Música en espera (archivo MikoPBX)">
            <MediaFileInput
              value={config.holdMusicUrl ?? ""}
              onChange={(v) => setConfig({ ...config, holdMusicUrl: v || null })}
              presets={PRESET_HOLD_MUSIC}
              placeholder="moh/archivo.mp3 o https://..."
            />
          </Field>
          <Field label={`Volumen ${config.volumePct}%`}>
            <input type="range" min={0} max={100} value={config.volumePct}
              onChange={(e) => setConfig({ ...config, volumePct: parseInt(e.target.value, 10) })}
              className="w-full" />
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[13px] text-df-text">
              <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} />
              Habilitado
            </label>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-df-border px-5 py-3">
          <a
            href="http://localhost:8090/admin-cabinet/sound-files/index/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] font-semibold text-df-brand-ink hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Subir archivos en la GUI de MikoPBX
          </a>
          <button type="button" onClick={handleSaveConfig}
            className="flex h-10 items-center gap-1.5 rounded-[10px] border-0 bg-df-navy px-4 text-[13px] font-bold text-white hover:brightness-110">
            <Save className="h-4 w-4" aria-hidden />
            Guardar configuración
          </button>
        </div>
      </Section>

      <Section title="Menú post-timeout (IVR)" hint={`Después de ${config.timeoutSeconds}s ofrecer estas opciones`}>
        <div className="flex flex-col gap-2 p-5">
          {options.map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-xl border border-df-border bg-df-surface-2 px-3.5 py-2.5">
              <span className="ff-mono inline-flex h-8 w-8 items-center justify-center rounded-md border border-df-border bg-df-surface text-[15px] font-bold text-df-text">
                {o.dtmfKey}
              </span>
              <span className="flex-1 text-[13px] text-df-text">{o.label}</span>
              <span className="rounded-md px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: "hsl(var(--df-brand) / 0.13)", color: "hsl(var(--df-brand-ink))" }}>
                {ACTION_LABEL[o.action]}
              </span>
              <button type="button" onClick={() => handleDeleteOption(o.id)} aria-label="Eliminar opción"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-df-border text-df-text-muted hover:text-df-hang">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-df-border bg-df-surface-2 px-3.5 py-2.5">
            <input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="DTMF"
              maxLength={1} className="ff-mono h-9 w-12 rounded-md border border-df-border bg-df-surface px-2 text-center text-[14px] font-bold outline-none focus:border-df-brand" />
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Texto que escucha el llamante"
              className="h-9 flex-1 rounded-md border border-df-border bg-df-surface px-2 text-[13px] outline-none focus:border-df-brand" />
            <select value={newAction} onChange={(e) => setNewAction(e.target.value as ParkingAction)}
              className="h-9 rounded-md border border-df-border bg-df-surface px-2 text-[12.5px] outline-none focus:border-df-brand">
              {(Object.keys(ACTION_LABEL) as ParkingAction[]).map((k) => <option key={k} value={k}>{ACTION_LABEL[k]}</option>)}
            </select>
            <button type="button" onClick={handleAddOption} disabled={!newKey || !newLabel}
              className="flex h-9 items-center gap-1.5 rounded-md border-0 bg-df-navy px-3 text-[12.5px] font-bold text-white hover:brightness-110 disabled:opacity-60">
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-df-border bg-df-surface shadow-[0_1px_2px_rgba(13,37,66,.04)]">
      <div className="flex items-center gap-3 border-b border-df-border px-5 py-4">
        <span className="h-4 w-1 rounded" style={{ background: "hsl(var(--df-brand))" }} />
        <div>
          <div className="ff-display text-[15px] font-bold text-df-text">{title}</div>
          {hint && <div className="text-[11.5px] text-df-text-dim">{hint}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-bold text-df-text-muted">{label}</label>
      {children}
    </div>
  );
}

function MediaFileInput({
  value,
  onChange,
  presets,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  presets: Array<{ label: string; value: string }>;
  placeholder: string;
}) {
  const matchedPreset = presets.find((p) => p.value === value);
  const showCustom = !matchedPreset;
  return (
    <div className="flex flex-col gap-2">
      <select
        value={showCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            onChange(value || "custom/");
          } else {
            onChange(e.target.value);
          }
        }}
        className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand"
      >
        {presets.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
        <option value="__custom__">Custom / URL externa…</option>
      </select>
      {showCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="ff-mono h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[13px] outline-none focus:border-df-brand"
        />
      )}
    </div>
  );
}
