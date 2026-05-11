/**
 * Cliente Supabase para componentes del navegador (Client Components).
 * Usa cookies de sesión gestionadas por @supabase/ssr.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
