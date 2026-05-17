/**
 * Schemas Zod para validación de formularios de autenticación.
 */
import { z } from "zod";
import { emailUdgSchema } from "./dominios-udg";

// Normaliza nombres a Title Case preservando tildes/Ñ que el usuario haya
// escrito. No infiere tildes faltantes. Maneja casos tipo "JUDITH CAROLINA
// DE ARCOS JIMÉNEZ" → "Judith Carolina De Arcos Jiménez", evitando el
// UPDATE manual que tocó correr en sesión 9f.
export function normalizarNombre(s: string): string {
  return s
    .trim()
    .toLocaleLowerCase("es-MX")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toLocaleUpperCase("es-MX") + token.slice(1))
    .join(" ");
}

const nombreSchema = (mensaje: string) =>
  z.string().min(2, mensaje).transform(normalizarNombre);

export const loginSchema = z.object({
  email: emailUdgSchema,
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: emailUdgSchema,
  nombre: nombreSchema("Nombre requerido"),
  apellido_paterno: nombreSchema("Apellido paterno requerido"),
  apellido_materno: z
    .string()
    .optional()
    .transform((s) => (s && s.trim().length > 0 ? normalizarNombre(s) : undefined)),
  codigo_udg: z
    .string()
    .regex(/^\d{7,8}$/, "Código UDG debe tener 7 u 8 dígitos"),
  centro_universitario: z.string().min(2).default("CUTLAJO"),
  division: z.string().min(2, "División requerida"),
  departamento: z.string().min(2, "Departamento requerido"),
});

export type SignupInput = z.infer<typeof signupSchema>;

export const crearContrasenaSchema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
      .regex(/[0-9]/, "Debe incluir al menos un número"),
    confirmar: z.string(),
  })
  .refine((data) => data.password === data.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });

export type CrearContrasenaInput = z.infer<typeof crearContrasenaSchema>;
