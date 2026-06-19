import { z } from "zod";

export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "El nombre es obligatorio (mínimo 2 caracteres)")
    .max(255, "Máximo 255 caracteres"),
  phone: z
    .string()
    .trim()
    .min(4, "El teléfono es obligatorio")
    .max(32, "Máximo 32 caracteres"),
  email: z
    .string()
    .trim()
    .max(255, "Máximo 255 caracteres")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Formato de email inválido",
    }),
  company: z.string().trim().max(255, "Máximo 255 caracteres"),
  notesSummary: z.string().trim().max(2000, "Máximo 2000 caracteres"),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

export const emptyClient: ClientFormValues = {
  name: "",
  phone: "",
  email: "",
  company: "",
  notesSummary: "",
};
