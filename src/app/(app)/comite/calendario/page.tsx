import { obtenerUsuarioActual, esMiembroComite } from "@/lib/auth/usuario-actual";
import { PageHeader } from "@/components/layout/PageHeader";
import { listarSesiones } from "@/lib/calendario/queries";
import { CalendarioReuniones } from "@/components/calendario/calendario-reuniones";
import { hoyEnJalisco } from "@/lib/calendario/formato";
import type { SesionComite } from "@/lib/calendario/types";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const usuario = await obtenerUsuarioActual();
  const esComite = esMiembroComite(usuario.roles);
  const puedeEditar =
    usuario.roles.includes("presidente") ||
    usuario.roles.includes("comite_secretario");

  const todas = await listarSesiones();
  // A quien no es del comité (investigadores) NO se le envían los datos
  // internos: enlace de Meet, teléfono, PIN ni orden del día.
  const sesiones: SesionComite[] = esComite
    ? todas
    : todas.map((s) => ({
        ...s,
        meet_link: null,
        meet_telefono: null,
        meet_pin: null,
        orden_del_dia: null,
      }));

  return (
    <div className="space-y-8">
      <PageHeader
        variant="teal"
        eyebrow="CEICS · CUTLAJO"
        title="Calendario de Reuniones"
        description={
          puedeEditar
            ? "Programa y consulta las sesiones del comité. Haz clic en un día para agendar; selecciona una sesión para ver su orden del día y el enlace de Google Meet."
            : "Consulta las sesiones previas y próximas del comité. Selecciona una sesión para ver sus detalles."
        }
      />
      <CalendarioReuniones
        sesiones={sesiones}
        hoy={hoyEnJalisco()}
        esComite={esComite}
        puedeEditar={puedeEditar}
      />
    </div>
  );
}
