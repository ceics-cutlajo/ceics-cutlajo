/**
 * Envío de email al Presidente del CEICS cuando el comité cierra la votación
 * de un protocolo y el caso queda listo para dictamen final presidencial.
 *
 * NOTA (sesión 8b — tarea #4 helpers/actions): este módulo se entrega como
 * stub para que los server actions ya puedan importarlo y la idempotencia
 * (notificacion_presidente_at) quede registrada. La integración real con
 * Resend se completa en la tarea #6 (sustituyendo el cuerpo de esta función).
 *
 * Mientras tanto: loggea a stdout y devuelve ok. El timestamp en la base de
 * datos ya queda marcado por el llamador, así que cuando se conecte Resend
 * no habrá pendientes acumulados (solo se enviarán cierres futuros).
 */
export type NotificacionPresidenteInput = {
  protocoloId: string;
  claveProtocolo: string;
  tituloProtocolo: string;
  ipNombre: string;
  resumenVoto: string;
  ganador: string;
  emailPresidente: string;
};

export async function notificarPresidente(
  input: NotificacionPresidenteInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // TODO sesión 8b · tarea #6: integrar con Resend (RESEND_API_KEY).
  console.log("[notificarPresidente:stub] cierre de votación", {
    protocoloId: input.protocoloId,
    clave: input.claveProtocolo,
    ganador: input.ganador,
    emailPresidente: input.emailPresidente,
  });
  return { ok: true };
}
