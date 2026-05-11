/**
 * Validación del dominio institucional UDG.
 * Solo correos de estos dominios pueden registrarse en la plataforma.
 */
import { z } from "zod";

export const DOMINIOS_PERMITIDOS = [
  "academicos.udg.mx",
  "cutlajomulco.udg.mx",
  "alumnos.udg.mx",
] as const;

export type DominioPermitido = (typeof DOMINIOS_PERMITIDOS)[number];

export function esEmailUdgValido(email: string): boolean {
  const dominio = email.toLowerCase().trim().split("@")[1];
  return DOMINIOS_PERMITIDOS.includes(dominio as DominioPermitido);
}

export function obtenerDominio(email: string): DominioPermitido | null {
  const dominio = email.toLowerCase().trim().split("@")[1];
  if (DOMINIOS_PERMITIDOS.includes(dominio as DominioPermitido)) {
    return dominio as DominioPermitido;
  }
  return null;
}

/** Schema Zod para email institucional */
export const emailUdgSchema = z
  .string()
  .min(5, "Correo demasiado corto")
  .email("Correo inválido")
  .refine(esEmailUdgValido, {
    message: `El correo debe ser institucional UDG (${DOMINIOS_PERMITIDOS.map((d) => "@" + d).join(", ")})`,
  });

/** Mensaje de ayuda para el usuario */
export const mensajeDominiosUdg =
  "Solo se permiten correos institucionales UDG: " +
  DOMINIOS_PERMITIDOS.map((d) => `@${d}`).join(", ");
