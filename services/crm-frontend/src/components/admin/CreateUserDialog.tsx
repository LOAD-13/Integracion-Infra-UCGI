import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, UserPlus } from "lucide-react";
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
import type { CreateUserPayload } from "@/api/users";

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
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

type FormValues = z.infer<typeof newUserSchema>;

interface CreateUserDialogProps {
  onCreate: (payload: CreateUserPayload) => Promise<void>;
}

export function CreateUserDialog({ onCreate }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
      password: "",
    },
  });

  async function handleCreate(values: FormValues) {
    setSubmitError(null);
    try {
      await onCreate(values);
      reset();
      setOpen(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "No se pudo crear el usuario",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          setSubmitError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alta de usuario</DialogTitle>
          <DialogDescription>
            La provisión SIP se dispara automáticamente con HU-05.3 (rol
            AgenteCallCenter en midPoint).
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(handleCreate)}
          className="space-y-3"
          noValidate
          aria-busy={isSubmitting}
        >
          <Field
            id="username"
            label="Username"
            error={errors.username?.message}
          >
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
          <Field id="password" label="Password inicial" error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </Field>
          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
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
