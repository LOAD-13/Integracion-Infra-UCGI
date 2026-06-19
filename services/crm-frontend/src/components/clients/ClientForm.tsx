import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  clientSchema,
  emptyClient,
  type ClientFormValues,
} from "@/clients/client-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ClientFormProps {
  defaultValues?: ClientFormValues;
  submitLabel: string;
  submitting?: boolean;
  errorMessage?: string | null;
  onSubmit: (values: ClientFormValues) => Promise<void> | void;
  onCancel?: () => void;
}

export function ClientForm({
  defaultValues = emptyClient,
  submitLabel,
  submitting = false,
  errorMessage = null,
  onSubmit,
  onCancel,
}: ClientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues,
    mode: "onBlur",
  });

  const busy = submitting || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
      aria-busy={busy}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nombre" error={errors.name?.message}>
          <Input
            id="name"
            disabled={busy}
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </Field>
        <Field id="phone" label="Teléfono" error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            disabled={busy}
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
        </Field>
        <Field id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            disabled={busy}
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
        <Field id="company" label="Empresa" error={errors.company?.message}>
          <Input
            id="company"
            disabled={busy}
            aria-invalid={!!errors.company}
            {...register("company")}
          />
        </Field>
      </div>
      <Field
        id="notesSummary"
        label="Resumen de notas"
        error={errors.notesSummary?.message}
      >
        <Textarea
          id="notesSummary"
          rows={3}
          disabled={busy}
          aria-invalid={!!errors.notesSummary}
          {...register("notesSummary")}
        />
      </Field>

      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
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
