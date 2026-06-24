import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import {
  createIvrOption,
  deleteIvrOption,
  generateTts,
  getParkingConfig,
  listIvrOptions,
  listMikoSoundFiles,
  updateParkingConfig,
  type MikoSoundFile,
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

export function AdminParkingPage() {
  const { session } = useAuth();
  const { push } = useToast();
  const [config, setConfig] = useState<ParkingConfig | null>(null);
  const [options, setOptions] = useState<ParkingIvrOption[]>([]);
  const [soundFiles, setSoundFiles] = useState<MikoSoundFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newAction, setNewAction] = useState<ParkingAction>("CALLBACK");
  const [ttsText, setTtsText] = useState(
    "Gracias por llamar. Todos nuestros agentes están ocupados. Por favor espere, su llamada es importante.",
  );
  const [ttsTarget, setTtsTarget] = useState<"greeting" | "moh">("greeting");
  const [ttsBusy, setTtsBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [c, o, files] = await Promise.all([
        getParkingConfig(session.token),
        listIvrOptions(session.token),
        listMikoSoundFiles(session.token).catch(() => [] as MikoSoundFile[]),
      ]);
      setConfig(c); setOptions(o); setSoundFiles(files);
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

  async function handleGenerateTts() {
    if (!session || !config) return;
    if (!ttsText.trim()) {
      push({ title: "Escribí el texto del TTS primero", kind: "warn" });
      return;
    }
    setTtsBusy(true);
    try {
      const created = await generateTts(session.token, ttsText.trim(), "es");
      push({ title: "Audio generado y subido al MikoPBX", desc: created.name, kind: "ok" });
      const ref = `miko-sound:${created.id}`;
      const updated = ttsTarget === "greeting"
        ? { ...config, greetingUrl: ref }
        : { ...config, holdMusicUrl: ref };
      setConfig(updated);
      await updateParkingConfig(session.token, updated);
      await load();
    } catch (e) {
      push({ title: "Error generando TTS", desc: (e as Error).message, kind: "warn" });
    } finally {
      setTtsBusy(false);
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
            <SoundFileSelect
              value={config.greetingUrl ?? ""}
              onChange={(v) => setConfig({ ...config, greetingUrl: v || null })}
              soundFiles={soundFiles}
            />
          </Field>
          <Field label="Música en espera (archivo MikoPBX)">
            <SoundFileSelect
              value={config.holdMusicUrl ?? ""}
              onChange={(v) => setConfig({ ...config, holdMusicUrl: v || null })}
              soundFiles={soundFiles}
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

      <Section
        title="Generar locución desde texto (TTS)"
        hint="Convertimos el texto a audio con Google TTS y lo registramos como sound-file en MikoPBX."
      >
        <div className="flex flex-col gap-3 p-5">
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Texto que el llamante escuchará…"
            className="w-full resize-y rounded-xl border border-df-border bg-df-surface-2 px-3.5 py-3 text-[14px] outline-none focus:border-df-brand"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12.5px] text-df-text">
              <input
                type="radio"
                name="tts-target"
                checked={ttsTarget === "greeting"}
                onChange={() => setTtsTarget("greeting")}
              />
              Aplicar como locución inicial
            </label>
            <label className="flex items-center gap-2 text-[12.5px] text-df-text">
              <input
                type="radio"
                name="tts-target"
                checked={ttsTarget === "moh"}
                onChange={() => setTtsTarget("moh")}
              />
              Aplicar como música en espera
            </label>
            <span className="ml-auto text-[11.5px] text-df-text-dim">{ttsText.length}/1000</span>
          </div>
          <button
            type="button"
            onClick={handleGenerateTts}
            disabled={ttsBusy}
            className="flex h-10 w-fit items-center gap-1.5 rounded-[10px] border-0 bg-df-navy px-4 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-60"
          >
            {ttsBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generar y aplicar
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

function SoundFileSelect({
  value,
  onChange,
  soundFiles,
}: {
  value: string;
  onChange: (v: string) => void;
  soundFiles: MikoSoundFile[];
}) {
  const isMikoRef = value.startsWith("miko-sound:");
  const mikoId = isMikoRef ? value.substring("miko-sound:".length) : null;
  const matched = mikoId ? soundFiles.find((f) => f.id === mikoId) : null;
  const shouldShowCustom = !!value && !isMikoRef;

  return (
    <div className="flex flex-col gap-2">
      <select
        value={isMikoRef ? `miko:${mikoId}` : shouldShowCustom ? "__custom__" : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") onChange("");
          else if (v === "__custom__") onChange("https://");
          else if (v.startsWith("miko:")) onChange(`miko-sound:${v.substring(5)}`);
        }}
        className="h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[14px] outline-none focus:border-df-brand"
      >
        <option value="">— Sin archivo —</option>
        {soundFiles.map((f) => (
          <option key={f.id} value={`miko:${f.id}`}>
            {f.name} ({f.category}{f.duration ? ` · ${f.duration}` : ""})
          </option>
        ))}
        <option value="__custom__">Custom / URL externa…</option>
      </select>
      {matched && (
        <div className="ff-mono text-[11px] text-df-text-dim">
          {matched.path}
        </div>
      )}
      {shouldShowCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="ff-mono h-10 w-full rounded-[10px] border border-df-border bg-df-surface-2 px-3 text-[13px] outline-none focus:border-df-brand"
        />
      )}
    </div>
  );
}
