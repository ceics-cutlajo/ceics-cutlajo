/**
 * Transparencia de la votación del comité: quién votó, cuándo y en qué sentido,
 * por protocolo. Por decisión del CEICS estos datos son públicos (fomento de la
 * transparencia). NO se exponen los comentarios individuales; el nombre del
 * investigador se omite en la vista pública (lo decide cada llamador).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { listarMiembrosElegiblesComite, type MiembroComite } from "./queries";
import type { TipoVoto } from "./types";

export type EstadoVotoMiembro = "voto" | "pendiente" | "conflicto";

export type VotoMiembro = {
  miembroId: string;
  nombre: string;
  apellidoPaterno: string;
  esPresidente: boolean;
  estado: EstadoVotoMiembro;
  voto: TipoVoto | null;
  votadoAt: string | null;
};

/** Emails (en minúsculas) en conflicto con el protocolo: IP + co-investigadores. */
async function emailsEnConflicto(protocoloId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const [{ data: prot }, { data: cois }] = await Promise.all([
    admin
      .from("protocolos")
      .select("investigador_principal_id")
      .eq("id", protocoloId)
      .maybeSingle(),
    admin
      .from("protocolo_co_investigadores")
      .select("email")
      .eq("protocolo_id", protocoloId),
  ]);
  const set = new Set<string>();
  if (prot?.investigador_principal_id) {
    const { data: ip } = await admin
      .from("usuarios")
      .select("email")
      .eq("id", prot.investigador_principal_id)
      .maybeSingle();
    if (ip?.email) set.add(ip.email.toLowerCase());
  }
  (cois ?? []).forEach((c) => {
    if (c.email) set.add(c.email.toLowerCase());
  });
  return set;
}

function ordenarVotos(a: VotoMiembro, b: VotoMiembro): number {
  if (a.esPresidente !== b.esPresidente) return a.esPresidente ? -1 : 1;
  return a.apellidoPaterno.localeCompare(b.apellidoPaterno, "es");
}

/**
 * Estado de voto de cada miembro elegible para un protocolo.
 * `miembrosPre` evita re-consultar el padrón cuando se procesan varios protocolos.
 */
export async function resumenVotacionProtocolo(
  protocoloId: string,
  miembrosPre?: MiembroComite[],
): Promise<VotoMiembro[]> {
  const admin = createAdminClient();
  const [miembros, evalsResp, coiEmails] = await Promise.all([
    miembrosPre
      ? Promise.resolve(miembrosPre)
      : listarMiembrosElegiblesComite(),
    admin
      .from("evaluaciones")
      .select("miembro_id, voto_global, conflicto_interes, votado_at")
      .eq("protocolo_id", protocoloId),
    emailsEnConflicto(protocoloId),
  ]);

  const evalPorMiembro = new Map(
    (evalsResp.data ?? []).map((e) => [e.miembro_id, e]),
  );

  return miembros
    .map((m): VotoMiembro => {
      const base = {
        miembroId: m.id,
        nombre: m.nombre,
        apellidoPaterno: m.apellidoPaterno,
        esPresidente: m.esPresidente,
      };
      const ev = evalPorMiembro.get(m.id);
      if (ev) {
        if (ev.conflicto_interes) {
          return { ...base, estado: "conflicto", voto: null, votadoAt: ev.votado_at };
        }
        return {
          ...base,
          estado: "voto",
          voto: ev.voto_global as TipoVoto,
          votadoAt: ev.votado_at,
        };
      }
      const enCOI = coiEmails.has(m.email.toLowerCase());
      return {
        ...base,
        estado: enCOI ? "conflicto" : "pendiente",
        voto: null,
        votadoAt: null,
      };
    })
    .sort(ordenarVotos);
}

export type ProtocoloVotacionPublico = {
  id: string;
  clave: string | null;
  titulo: string;
  estado: string;
  submittedAt: string | null;
  votos: VotoMiembro[];
};

// Estados en los que ya hay (o hubo) votación del comité que mostrar.
const ESTADOS_CON_VOTACION = [
  "en_revision_comite",
  "listo_dictamen",
  "observaciones",
  "aprobado",
  "aprobado_con_observaciones",
  "rechazado",
] as const;

/** Votación de todos los protocolos sometidos a revisión (vista pública). */
export async function listarVotacionPublica(): Promise<ProtocoloVotacionPublico[]> {
  const admin = createAdminClient();
  const { data: prots } = await admin
    .from("protocolos")
    .select("id, clave, titulo, estado, submitted_at")
    .in("estado", ESTADOS_CON_VOTACION as unknown as string[])
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (!prots || prots.length === 0) return [];

  const miembros = await listarMiembrosElegiblesComite();
  return Promise.all(
    prots.map(async (p) => ({
      id: p.id,
      clave: p.clave,
      titulo: p.titulo,
      estado: p.estado,
      submittedAt: p.submitted_at,
      votos: await resumenVotacionProtocolo(p.id, miembros),
    })),
  );
}
