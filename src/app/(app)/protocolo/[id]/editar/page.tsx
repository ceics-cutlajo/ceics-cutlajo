import { notFound, redirect } from "next/navigation";
import { obtenerProtocolo } from "@/lib/protocolos/queries";
import { ProtocoloWizard } from "./wizard";

export default async function EditarProtocoloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const datos = await obtenerProtocolo(id);
  if (!datos) notFound();

  // Solo el dueño puede editar y solo en borrador/observaciones
  if (!datos.esPropietario) redirect(`/protocolo/${id}`);
  if (datos.protocolo.estado !== "borrador" && datos.protocolo.estado !== "observaciones") {
    redirect(`/protocolo/${id}`);
  }

  return (
    <ProtocoloWizard
      protocolo={datos.protocolo}
      coInvestigadores={datos.coInvestigadores}
      documentos={datos.documentos}
    />
  );
}
