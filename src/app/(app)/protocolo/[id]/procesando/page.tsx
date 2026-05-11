import { notFound, redirect } from "next/navigation";
import { obtenerProtocolo, obtenerEstadoExtraccion } from "@/lib/protocolos/queries";
import { Procesando } from "./procesando";

export const dynamic = "force-dynamic";

export default async function ProcesandoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const datos = await obtenerProtocolo(id);
  if (!datos) notFound();
  if (!datos.esPropietario) redirect(`/protocolo/${id}`);

  const estado = await obtenerEstadoExtraccion(id);
  if (!estado) notFound();

  // Si la extracción ya completó y los campos fueron aplicados, ir al wizard
  if (!estado.esperando_extraccion && estado.extraccion?.estado === "completado") {
    redirect(`/protocolo/${id}/editar?aviso=ia_completada`);
  }

  // Si ya no esperamos extracción (saltó o falló sin re-disparar), ir al wizard
  if (!estado.esperando_extraccion && estado.extraccion?.estado === "error") {
    redirect(`/protocolo/${id}/editar?aviso=ia_error`);
  }

  return <Procesando protocoloId={id} estadoInicial={estado} />;
}
