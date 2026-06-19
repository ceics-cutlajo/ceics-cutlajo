/**
 * Cron de limpieza de archivos HUÉRFANOS en Supabase Storage (modo dry-run).
 *
 * Recorre los buckets de Storage `protocolos` y `actas`, los compara contra las
 * referencias guardadas en la base de datos y reporta los archivos que NINGUNA
 * fila referencia (huérfanos). Estos archivos quedan típicamente al reemplazar
 * un documento por ronda, al regenerar un acta, o por subidas que luego fallaron
 * al registrar su metadata.
 *
 * Esquema de referencias (fuente de verdad):
 *   - bucket `protocolos`  → tabla `protocolo_documentos`, columna `storage_path`
 *     (paths `{protocoloId}/r{ronda}/{tipo}-{ts}.{ext}`).
 *   - bucket `actas`       → tabla `actas`, columnas `docx_storage_path` y
 *     `pdf_storage_path` (paths `{protocoloId}/acta-{slug}.{ext}`).
 *   En ambos buckets la carpeta de primer nivel es el `protocolo_id` (UUID).
 *
 * SEGURIDAD DEL BORRADO (conservador, por diseño):
 *   - Por defecto NO borra nada: devuelve el conteo y la lista de huérfanos y
 *     los registra con console.warn. El cron programado (vercel.json) corre SIN
 *     `?confirm`, así que solo reporta. El borrado real lo dispara Jaime a mano.
 *   - Solo con `?confirm=true` borra, y aun así jamás toca un archivo que esté
 *     referenciado en BD. La comparación es POR ARCHIVO (no por carpeta): que la
 *     carpeta `{protocolo_id}` siga existiendo con un protocolo en BD no salva a
 *     un archivo puntual sin referencia, pero tampoco arrastra a sus hermanos
 *     referenciados.
 *   - Ante cualquier duda (carpeta de primer nivel cuyo nombre no parece un
 *     UUID), el archivo se reporta como `ambiguos` y NUNCA se borra.
 *
 * Seguridad de acceso: si `CRON_SECRET` está configurada, Vercel la envía como
 * `Authorization: Bearer <CRON_SECRET>`; aquí se valida (401 si no coincide).
 * Mismo patrón que el resto de crons en `app/src/app/api/cron/*`.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// Listar Storage puede paginar varias veces por bucket; margen amplio.
export const maxDuration = 120;

type AdminClient = ReturnType<typeof createAdminClient>;

/** UUID v4-ish: las carpetas de primer nivel deben ser un `protocolo_id`. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tamaño de página de `storage.list` (máximo razonable; el SDK admite 100..1000).
const PAGINA = 1000;
// Tamaño de lote para `storage.remove`.
const LOTE_BORRADO = 100;

type ResumenBucket = {
  bucket: string;
  archivosEnStorage: number;
  referenciadosEnBd: number;
  huerfanos: string[];
  /** Carpetas de primer nivel con nombre no-UUID: nunca se borran, solo se avisan. */
  ambiguos: string[];
  borrados?: string[];
  erroresBorrado?: string[];
};

type Resultado = {
  ok: boolean;
  modo: "reporte" | "borrado";
  generadoEn: string;
  totalHuerfanos: number;
  buckets: ResumenBucket[];
  errores: string[];
};

/**
 * Lista TODOS los archivos de un bucket recorriendo las carpetas de primer
 * nivel (cada una es un `protocolo_id`). Devuelve los paths completos relativos
 * al bucket y, por separado, las carpetas con nombre no-UUID (ambiguas).
 *
 * En ambos buckets la jerarquía es `{protocoloId}/...`; en `protocolos` hay un
 * nivel extra `r{ronda}/` que también se recorre. `storage.list` no es
 * recursivo, así que descendemos manualmente.
 */
async function listarArchivosBucket(
  admin: AdminClient,
  bucket: string,
  errores: string[],
): Promise<{ archivos: string[]; ambiguos: string[] }> {
  const archivos: string[] = [];
  const ambiguos: string[] = [];

  const carpetasNivel1 = await listarEntradas(admin, bucket, "", errores);

  for (const entrada of carpetasNivel1) {
    // Las entradas con `id === null` son carpetas (prefijos); con `id` no nulo,
    // archivos sueltos en la raíz (no esperados, pero los contamos).
    if (entrada.esCarpeta) {
      if (!UUID_RE.test(entrada.nombre)) {
        // Carpeta de primer nivel que no parece un protocolo_id: no la tocamos.
        ambiguos.push(`${entrada.nombre}/ (carpeta de primer nivel no reconocida)`);
        continue;
      }
      await recorrerCarpeta(admin, bucket, entrada.nombre, archivos, errores);
    } else {
      // Archivo suelto en la raíz del bucket: ambiguo, no lo tocamos.
      ambiguos.push(`${entrada.nombre} (archivo en raíz del bucket)`);
    }
  }

  return { archivos, ambiguos };
}

/** Desciende por una carpeta `protocolo_id/...` acumulando los paths de archivos. */
async function recorrerCarpeta(
  admin: AdminClient,
  bucket: string,
  prefijo: string,
  acumulador: string[],
  errores: string[],
): Promise<void> {
  const entradas = await listarEntradas(admin, bucket, prefijo, errores);
  for (const e of entradas) {
    const path = `${prefijo}/${e.nombre}`;
    if (e.esCarpeta) {
      await recorrerCarpeta(admin, bucket, path, acumulador, errores);
    } else {
      acumulador.push(path);
    }
  }
}

type Entrada = { nombre: string; esCarpeta: boolean };

/** Lista una carpeta de Storage con paginación completa. */
async function listarEntradas(
  admin: AdminClient,
  bucket: string,
  prefijo: string,
  errores: string[],
): Promise<Entrada[]> {
  const entradas: Entrada[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefijo, {
      limit: PAGINA,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      errores.push(`list ${bucket}/${prefijo}: ${error.message}`);
      break;
    }
    const pagina = data ?? [];
    for (const item of pagina) {
      // En storage-js, una entrada de carpeta no tiene `id` (ni metadata).
      const esCarpeta = item.id === null || item.id === undefined;
      entradas.push({ nombre: item.name, esCarpeta });
    }
    if (pagina.length < PAGINA) break;
    offset += PAGINA;
  }

  return entradas;
}

/** Paths referenciados en `protocolo_documentos.storage_path`. */
async function pathsReferenciadosProtocolos(
  admin: AdminClient,
  errores: string[],
): Promise<Set<string>> {
  const refs = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from("protocolo_documentos")
      .select("storage_path")
      .range(offset, offset + PAGINA - 1);
    if (error) {
      errores.push(`bd protocolo_documentos: ${error.message}`);
      break;
    }
    const filas = (data ?? []) as { storage_path: string | null }[];
    for (const f of filas) {
      if (f.storage_path) refs.add(f.storage_path);
    }
    if (filas.length < PAGINA) break;
    offset += PAGINA;
  }
  return refs;
}

/** Paths referenciados en `actas` (docx + pdf). */
async function pathsReferenciadosActas(
  admin: AdminClient,
  errores: string[],
): Promise<Set<string>> {
  const refs = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from("actas")
      .select("docx_storage_path, pdf_storage_path")
      .range(offset, offset + PAGINA - 1);
    if (error) {
      errores.push(`bd actas: ${error.message}`);
      break;
    }
    const filas = (data ?? []) as {
      docx_storage_path: string | null;
      pdf_storage_path: string | null;
    }[];
    for (const f of filas) {
      if (f.docx_storage_path) refs.add(f.docx_storage_path);
      if (f.pdf_storage_path) refs.add(f.pdf_storage_path);
    }
    if (filas.length < PAGINA) break;
    offset += PAGINA;
  }
  return refs;
}

/** Borra los huérfanos de un bucket en lotes; devuelve borrados y errores. */
async function borrarHuerfanos(
  admin: AdminClient,
  bucket: string,
  huerfanos: string[],
): Promise<{ borrados: string[]; erroresBorrado: string[] }> {
  const borrados: string[] = [];
  const erroresBorrado: string[] = [];
  for (let i = 0; i < huerfanos.length; i += LOTE_BORRADO) {
    const lote = huerfanos.slice(i, i + LOTE_BORRADO);
    const { data, error } = await admin.storage.from(bucket).remove(lote);
    if (error) {
      erroresBorrado.push(`remove ${bucket} [${i}..]: ${error.message}`);
      continue;
    }
    for (const obj of data ?? []) borrados.push(obj.name);
  }
  return { borrados, erroresBorrado };
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const confirm = url.searchParams.get("confirm") === "true";
  const errores: string[] = [];
  const admin = createAdminClient();

  // 1. Referencias en BD (en paralelo).
  const [refsProtocolos, refsActas] = await Promise.all([
    pathsReferenciadosProtocolos(admin, errores),
    pathsReferenciadosActas(admin, errores),
  ]);

  // 2. Archivos en Storage (en paralelo).
  const [storProtocolos, storActas] = await Promise.all([
    listarArchivosBucket(admin, "protocolos", errores),
    listarArchivosBucket(admin, "actas", errores),
  ]);

  // 3. Huérfanos = en Storage pero NO referenciados en BD.
  const huerfanosProtocolos = storProtocolos.archivos.filter(
    (p) => !refsProtocolos.has(p),
  );
  const huerfanosActas = storActas.archivos.filter((p) => !refsActas.has(p));

  const buckets: ResumenBucket[] = [
    {
      bucket: "protocolos",
      archivosEnStorage: storProtocolos.archivos.length,
      referenciadosEnBd: refsProtocolos.size,
      huerfanos: huerfanosProtocolos,
      ambiguos: storProtocolos.ambiguos,
    },
    {
      bucket: "actas",
      archivosEnStorage: storActas.archivos.length,
      referenciadosEnBd: refsActas.size,
      huerfanos: huerfanosActas,
      ambiguos: storActas.ambiguos,
    },
  ];

  // 4. Borrado SOLO si ?confirm=true; jamás toca lo referenciado ni lo ambiguo.
  if (confirm) {
    for (const b of buckets) {
      if (b.huerfanos.length === 0) {
        b.borrados = [];
        b.erroresBorrado = [];
        continue;
      }
      const { borrados, erroresBorrado } = await borrarHuerfanos(
        admin,
        b.bucket,
        b.huerfanos,
      );
      b.borrados = borrados;
      b.erroresBorrado = erroresBorrado;
      errores.push(...erroresBorrado);
      console.warn(
        `[limpieza-huerfanos] BORRADO bucket "${b.bucket}": ${borrados.length}/${b.huerfanos.length} archivos eliminados.`,
        borrados,
      );
    }
  }

  const totalHuerfanos = huerfanosProtocolos.length + huerfanosActas.length;
  const totalAmbiguos =
    storProtocolos.ambiguos.length + storActas.ambiguos.length;

  // Resumen siempre a la bitácora (modo reporte usa warn para que destaque).
  const log = totalHuerfanos > 0 ? console.warn : console.log;
  log(
    `[limpieza-huerfanos] modo=${confirm ? "borrado" : "reporte"} huerfanos=${totalHuerfanos} ` +
      `(protocolos=${huerfanosProtocolos.length}, actas=${huerfanosActas.length}) ` +
      `ambiguos=${totalAmbiguos} errores=${errores.length}`,
  );
  if (totalHuerfanos > 0 && !confirm) {
    console.warn(
      "[limpieza-huerfanos] Lista de huérfanos (reporte, sin borrar):",
      { protocolos: huerfanosProtocolos, actas: huerfanosActas },
    );
  }

  const resultado: Resultado = {
    ok: true,
    modo: confirm ? "borrado" : "reporte",
    generadoEn: new Date().toISOString(),
    totalHuerfanos,
    buckets,
    errores,
  };
  return NextResponse.json(resultado);
}
