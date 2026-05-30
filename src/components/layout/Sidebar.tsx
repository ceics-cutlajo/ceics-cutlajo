"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Upload, BookOpen, Inbox, Users, FileText, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import type { RolSistema } from "@/types/domain";
import { logoutAction } from "@/lib/auth/actions";

type Item = { href: string; icon: React.ElementType; label: string; count?: number };

const NAVS: Record<RolSistema, Item[]> = {
  investigador: [
    { href: "/dashboard",      icon: LayoutDashboard, label: "Mis protocolos" },
    { href: "/protocolo/nuevo", icon: Upload,         label: "Nuevo protocolo" },
    { href: "/comite/integrantes", icon: Users,       label: "Comité" },
    { href: "/normatividad",   icon: BookOpen,        label: "Normatividad" },
  ],
  // Vocales y Secretaría ven las mismas secciones que la Presidencia en modo
  // lectura (Tablero y Actas), además de su Bandeja de votación y el directorio
  // del Comité. La emisión de actas/dictamen sigue restringida por página.
  comite_vocal: [
    { href: "/presidencia",        icon: LayoutDashboard, label: "Tablero" },
    { href: "/comite/bandeja",     icon: Inbox,           label: "Bandeja" },
    { href: "/presidencia/actas",  icon: FileText,        label: "Actas" },
    { href: "/comite/integrantes", icon: Users,           label: "Comité" },
    { href: "/normatividad",       icon: BookOpen,        label: "Normatividad" },
  ],
  comite_secretario: [
    { href: "/presidencia",        icon: LayoutDashboard, label: "Tablero" },
    { href: "/comite/bandeja",     icon: Inbox,           label: "Bandeja" },
    { href: "/presidencia/actas",  icon: FileText,        label: "Actas" },
    { href: "/comite/integrantes", icon: Users,           label: "Comité" },
    { href: "/normatividad",       icon: BookOpen,        label: "Normatividad" },
  ],
  presidente: [
    { href: "/presidencia",        icon: LayoutDashboard, label: "Tablero" },
    { href: "/comite/bandeja",     icon: Inbox,           label: "Todos los protocolos" },
    { href: "/presidencia/actas",  icon: FileText,        label: "Actas" },
    { href: "/comite/integrantes", icon: Users,           label: "Comité" },
    { href: "/normatividad",       icon: BookOpen,        label: "Normatividad" },
  ],
  admin_sistema: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  ],
};

export function Sidebar({
  rol,
  usuario,
}: {
  rol: RolSistema;
  usuario: { nombre: string; cargo: string; iniciales: string };
}) {
  const pathname = usePathname();
  const items = NAVS[rol] ?? [];

  const labelRol: Record<RolSistema, string> = {
    investigador: "Investigador",
    comite_vocal: "Vocal del Comité",
    comite_secretario: "Secretaría del Comité",
    presidente: "Presidencia",
    admin_sistema: "Administración",
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] flex-col gap-6 overflow-y-auto bg-side-bg p-5 text-side-fg">
      <Logo variant="dark" />

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-side-muted">
          {labelRol[rol]}
        </div>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-side-active text-white"
                    : "text-side-fg/80 hover:bg-side-hover hover:text-white"
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.count != null && (
                  <span className="ml-auto rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white">
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1" />

      <div className="border-t border-white/5 pt-4">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-side-muted">
          Cuenta
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
            {usuario.iniciales}
          </div>
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-sm font-medium text-white">{usuario.nombre}</span>
            <span className="text-[11px] text-side-muted">{usuario.cargo}</span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md p-1.5 text-side-muted hover:bg-side-hover hover:text-white"
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
