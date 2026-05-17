import { Sidebar } from "@/components/layout/Sidebar";
import {
  obtenerUsuarioActual,
  inicialesDe,
  nombreCompletoDe,
  cargoDe,
} from "@/lib/auth/usuario-actual";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await obtenerUsuarioActual();

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-animated-cutlajo">
      <Sidebar
        rol={usuario.rolPrincipal}
        usuario={{
          nombre: nombreCompletoDe(usuario),
          cargo: cargoDe(usuario.rolPrincipal),
          iniciales: inicialesDe(usuario.nombre, usuario.apellido_paterno),
        }}
      />
      <main className="overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
