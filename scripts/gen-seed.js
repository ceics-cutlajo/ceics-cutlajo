#!/usr/bin/env node
/**
 * gen-seed.js — Genera supabase/migrations/005_checklist_seed.sql
 * a partir de NORMATIVIDAD/04_CHECKLIST_MAESTRO.json
 *
 * Uso: node scripts/gen-seed.js
 */
const fs = require("fs");
const path = require("path");

const JSON_PATH = path.resolve(__dirname, "../../NORMATIVIDAD/04_CHECKLIST_MAESTRO.json");
const SQL_PATH = path.resolve(__dirname, "../supabase/migrations/005_checklist_seed.sql");

function esc(s) {
  if (s === null || s === undefined) return "null";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function main() {
  const raw = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  const items = raw.items || [];
  if (items.length === 0) {
    console.error("El JSON no tiene items.");
    process.exit(1);
  }

  const lines = [
    "-- =============================================================",
    "-- 005_checklist_seed.sql — GENERADO AUTOMÁTICAMENTE",
    "-- Fuente: NORMATIVIDAD/04_CHECKLIST_MAESTRO.json",
    `-- Total items: ${items.length}`,
    `-- Fecha: ${new Date().toISOString()}`,
    "-- NO EDITAR A MANO. Regenerar con `node scripts/gen-seed.js`.",
    "-- =============================================================",
    "",
    "begin;",
    "",
  ];

  for (const it of items) {
    const fuentesJson = JSON.stringify(it.fuentes);
    const aplicJson = JSON.stringify(it.aplicabilidad);
    const sql = `insert into checklist_items (
  id, categoria, subcategoria, criterio, evidencia_esperada,
  fuentes, severidad, peso, aplicabilidad, seccion_protocolo, ai_prompt_hint
) values (
  ${esc(it.id)},
  ${esc(it.categoria)},
  ${it.subcategoria ? esc(it.subcategoria) : "null"},
  ${esc(it.criterio)},
  ${esc(it.evidencia_esperada)},
  ${esc(fuentesJson)}::jsonb,
  ${esc(it.severidad)},
  ${it.peso},
  ${esc(aplicJson)}::jsonb,
  ${it.seccion_protocolo ?? "null"},
  ${esc(it.ai_prompt_hint)}
) on conflict (id) do update set
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
    lines.push(sql);
    lines.push("");
  }

  lines.push("commit;");
  lines.push("");
  lines.push(`-- ✅ ${items.length} ítems insertados/actualizados.`);

  fs.writeFileSync(SQL_PATH, lines.join("\n"));
  console.log(`✅ Generado ${SQL_PATH}`);
  console.log(`   ${items.length} ítems · ${fs.statSync(SQL_PATH).size} bytes`);
}

main();
