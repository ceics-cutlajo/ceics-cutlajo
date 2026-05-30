import { redirect } from "next/navigation";

// La gestión/directorio del comité vive ahora en /comite/integrantes, visible
// para todo el padrón institucional. Esta ruta antigua se conserva como
// redirección para no romper enlaces previos.
export default function PresidenciaComiteRedirect() {
  redirect("/comite/integrantes");
}
