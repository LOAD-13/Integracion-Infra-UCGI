import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreateUserPayload, UserSummary } from "@/api/users";

// eslint-disable-next-line react-refresh/only-export-components
export const newUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(64, "Máximo 64 caracteres")
    .regex(/^[a-z0-9._-]+$/, "Solo minúsculas, dígitos, punto, guion bajo o guion"),
  email: z.string().trim().email("Email inválido").max(255),
  fullName: z.string().trim().min(2, "Obligatorio").max(255),
  role: z.enum(["ADMIN", "AGENTE"]),
});

type FormValues = z.infer<typeof newUserSchema>;

interface CreateUserDialogProps {
  onCreate: (payload: CreateUserPayload) => Promise<UserSummary>;
}

export function CreateUserDialog({ onCreate }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<UserSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      username: "",
      email: "",
      fullName: "",
      role: "AGENTE",
    },
  });

  async function handleCreate(values: FormValues) {
    setSubmitError(null);
    try {
      const created = await onCreate(values);
      setGenerated(created);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "No se pudo crear el usuario",
      );
    }
  }

  function close() {
    setOpen(false);
    setGenerated(null);
    setCopied(false);
    reset();
    setSubmitError(null);
  }

  async function copyPassword() {
    if (!generated?.generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generated.generatedPassword);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // sin clipboard API: el admin la copia a mano del input visible
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!generated ? (
          <>
            <DialogHeader>
              <DialogTitle>Alta de usuario</DialogTitle>
              <DialogDescription>
                La contraseña inicial se genera automáticamente con el patrón <code className="ff-mono">nombre.apellido</code>.
                El usuario deberá cambiarla en su primer ingreso. midPoint detecta el alta vía el resource Scripted SQL
                para gobernanza de identidades.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleSubmit(handleCreate)}
              className="space-y-3"
              noValidate
              aria-busy={isSubmitting}
            >
              <Field id="username" label="Username" error={errors.username?.message}>
                <Input id="username" autoComplete="off" {...register("username")} />
              </Field>
              <Field id="fullName" label="Nombre completo" error={errors.fullName?.message}>
                <Input id="fullName" {...register("fullName")} />
              </Field>
              <Field id="email" label="Email" error={errors.email?.message}>
                <Input id="email" type="email" {...register("email")} />
              </Field>
              <Field id="role" label="Rol" error={errors.role?.message}>
                <select
                  id="role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register("role")}
                >
                  <option value="AGENTE">AGENTE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </Field>
              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Crear usuario
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Usuario creado</DialogTitle>
              <DialogDescription>
                Compartile esta contraseña al usuario por un canal seguro. <b>Solo aparece una vez</b> —
                en su primer ingreso el sistema le pedirá cambiarla.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="flex flex-col gap-1">
                <Label>Usuario</Label>
                <div className="ff-mono rounded-md border border-df-border bg-df-surface-2 px-3 py-2 text-sm">
                  {generated.username}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Contraseña inicial</Label>
                <div className="flex items-center gap-2">
                  <div className="ff-mono flex-1 rounded-md border border-df-border bg-df-surface-2 px-3 py-2 text-sm">
                    {generated.generatedPassword ?? "—"}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={close}>Entendido</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p className="text-xs text-destructive" data-testid={`error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}
