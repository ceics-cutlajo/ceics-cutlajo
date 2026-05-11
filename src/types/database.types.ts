/**
 * Tipos generados de Supabase.
 *
 * Este archivo se REEMPLAZA con `pnpm db:types` una vez que el proyecto
 * Supabase esté creado y conectado. Por ahora es un placeholder mínimo.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          email: string;
          nombre: string;
          apellido_paterno: string;
          apellido_materno: string | null;
          codigo_udg: string;
          centro_universitario: string;
          division: string | null;
          departamento: string | null;
          telefono: string | null;
          activo: boolean;
          email_verificado: boolean;
          created_at: string;
          updated_at: string;
          last_login: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["usuarios"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["usuarios"]["Insert"]>;
      };
      usuario_roles: {
        Row: {
          usuario_id: string;
          rol: "investigador" | "comite_vocal" | "comite_secretario" | "presidente" | "admin_sistema";
          asignado_en: string;
          asignado_por: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["usuario_roles"]["Row"], "asignado_en">;
        Update: Partial<Database["public"]["Tables"]["usuario_roles"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
