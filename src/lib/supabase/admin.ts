/**
 * Cliente Supabase con SERVICE ROLE — bypass de RLS.
 * Usar SOLO en el servidor para operaciones administrativas
 * (signup con creación de perfil, scheduled tasks, etc.)
 *
 * NUNCA importar este archivo desde código que se envíe al navegador.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
