/**
 * Schemas Zod para validación de formularios de autenticación.
 */
import { z } from "zod";
import { emailUdgSchema } from "./dominios-udg";

export const loginSchema = z.object({
  email: emailUdgSchema,
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: emailUdgSchema,
  nombre: z.string().min(2, "Nombre requerido"),
  apellido_paterno: z.string().min(2, "Apellido paterno requerido"),
  apellido_materno: z.string().optional(),
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
