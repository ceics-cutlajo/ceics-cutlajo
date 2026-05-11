/**
 * Tipos del schema de Supabase.
 *
 * Placeholder permisivo hasta que se conecte el CLI de Supabase y se generen
 * los tipos automáticamente con `pnpm db:types` (que ejecuta
 * `supabase gen types typescript --linked > src/types/database.types.ts`).
 *
 * Mientras tanto, este Database genérico permite cualquier operación contra
 * cualquier tabla sin perder la integración con @supabase/ssr y @supabase/supabase-js.
 *
 * TODO sesión 5: ejecutar `pnpm db:types` y reemplazar este archivo con los tipos generados.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;

type GenericTable = {
  Row: AnyRow;
  Insert: AnyRow;
  Update: AnyRow;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      [key: string]: GenericTable;
    };
    Views: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: { Row: AnyRow; Insert: AnyRow; Update: AnyRow; Relationships: [] };
    };
    Functions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: { Args: AnyRow; Returns: any };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: AnyRow;
    };
  };
}
