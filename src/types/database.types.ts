/**
 * Tipos del schema de Supabase.
 *
 * Placeholder permisivo hasta que se conecte el CLI de Supabase y se generen
 * los tipos automáticamente con `pnpm db:types`.
 *
 * TODO sesión 5: ejecutar `pnpm db:types` y reemplazar este archivo.
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
      [key: string]: GenericTable;
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
