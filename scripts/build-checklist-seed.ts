/**
 * scripts/build-checklist-seed.ts
 *
 * Lee NORMATIVIDAD/04_CHECKLIST_MAESTRO.json y genera el archivo
 * supabase/migrations/005_checklist_seed.sql con los 100 INSERT.
 *
 * Uso:
 *   pnpm tsx scripts/build-checklist-seed.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

type Item = {
  id: string;
  categoria: string;
  subcategoria?: string;
  criterio: string;
  evidencia_esperada: string;
  fuentes: { ref: string; url: string }[];
  severidad: "critica" | "alta" | "media" | "baja";
  peso: number;
  aplicabilidad: Record<string, unknown>;
  seccion_protocolo?: number | null;
  ai_prompt_hint: string;
};

const RUTA_JSON = path.resolve(__dirname, "../../NORMATIVIDAD/04_CHECKLIST_MAESTRO.json");
const RUTA_SQL = path.resolve(__dirname, "../supabase/migrations/005_checklist_seed.sql");

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

function main() {
  if (!fs.existsSync(RUTA_JSON)) {
    console.error("No se encontró el JSON en:", RUTA_JSON);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RUTA_JSON, "utf-8"));
  const items: Item[] = Array.isArray(raw) ? raw : raw.items ?? raw.checklist ?? [];

  if (items.length === 0) {
    console.error("El JSON no contiene items reconocibles.");
    process.exit(1);
  }

  const lineas: string[] = [
    "-- =============================================================",
    "-- 005_checklist_seed.sql — GENERADO AUTOMÁTICAMENTE",
    `-- Fuente: NORMATIVIDAD/04_CHECKLIST_MAESTRO.json`,
    `-- Total ítems: ${items.length}`,
    `-- Generado: ${new Date().toISOString()}`,
    "-- =============================================================",
    "",
    "begin;",
    "",
  ];

  for (const it of items) {
    const sql = `insert into checklist_items (id, categoria, subcategoria, criterio, evidencia_esperada, fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint) values
  ('${escapeSql(it.id)}',
   '${escapeSql(it.categoria)}',
   ${it.subcategoria ? `'${escapeSql(it.subcategoria)}'` : "null"},
   '${escapeSql(it.criterio)}',
   '${escapeSql(it.evidencia_esperada)}',
   '${escapeSql(JSON.stringify(it.fuentes))}'::jsonb,
   '${it.severidad}',
   ${it.peso},
   '${escapeSql(JSON.stringify(it.aplicabilidad))}'::jsonb,
   ${it.seccion_protocolo ?? "null"},
   '${escapeSql(it.ai_prompt_hint)}')
  on conflict (id) do update set
    categoria = excluded.categoria,
    subcategoria = excluded.subcategoria,
    criterio = excluded.criterio,
    evidencia_esperada = excluded.evidencia_esperada,
    fuentes = excluded.fuentes,
    severidad = excluded.severidad,
    peso = excluded.peso,
    aplicabilidad = excluded.aplicabilidad,
    seccion_protocolo = excluded.seccion_protocolo,
    ai_prompt_hint = excluded.ai_prompt_hint;`;
    lineas.push(sql);
    lineas.push("");
  }

  lineas.push("commit;");
  lineas.push("");
  lineas.push(`-- ${items.length} ítems insertados/actualizados.`);

  fs.writeFileSync(RUTA_SQL, lineas.join("\n"), "utf-8");
  console.log(`✅ Generado ${RUTA_SQL} con ${items.length} ítems.`);
}

main();
