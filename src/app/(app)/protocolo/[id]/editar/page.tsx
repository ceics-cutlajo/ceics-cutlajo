import { notFound, redirect } from "next/navigation";
import { obtenerProtocolo } from "@/lib/protocolos/queries";
import { ProtocoloWizard } from "./wizard";

export default async function EditarProtocoloPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const datos = await obtenerProtocolo(id);
  if (!datos) notFound();

  if (!datos.esPropietario) redirect(`/protocolo/${id}`);
  if (datos.protocolo.estado !== "borrador" && datos.protocolo.estado !== "observaciones") {
    redirect(`/protocolo/${id}`);
  }

  // Si todavía está esperando la IA, llevarlo a la pantalla de procesando
  if (datos.protocolo.esperando_extraccion) {
    redirect(`/protocolo/${id}/procesando`);
  }

  return (
    <ProtocoloWizard
      protocolo={datos.protocolo}
      coInvestigadores={datos.coInvestigadores}
      documentos={datos.documentos}
      extraccion={datos.extraccion}
      aviso={aviso ?? null}
    />
  );
}
