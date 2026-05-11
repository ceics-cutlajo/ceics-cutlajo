"use server";

/**
 * Server Actions de autenticación.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signupSchema, loginSchema, crearContrasenaSchema } from "./schemas";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { ok: false, error: traducirErrorAuth(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signupAction(formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    nombre: formData.get("nombre"),
    apellido_paterno: formData.get("apellido_paterno"),
    apellido_materno: formData.get("apellido_materno") || undefined,
    codigo_udg: formData.get("codigo_udg"),
    centro_universitario: formData.get("centro_universitario") || "CUTLAJO",
    division: formData.get("division"),
    departamento: formData.get("departamento"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const admin = createAdminClient();
  const supabase = await createClient();

  // 1. Crear el perfil en `usuarios` (idempotente vía upsert)
  const { error: errorPerfil } = await admin.from("usuarios").upsert(
    {
      email: parsed.data.email,
      nombre: parsed.data.nombre,
      apellido_paterno: parsed.data.apellido_paterno,
      apellido_materno: parsed.data.apellido_materno ?? null,
      codigo_udg: parsed.data.codigo_udg,
      centro_universitario: parsed.data.centro_universitario,
      division: parsed.data.division,
      departamento: parsed.data.departamento,
      activo: true,
      email_verificado: false,
    },
    { onConflict: "email" },
  );
  if (errorPerfil) {
    return { ok: false, error: "Error al crear perfil: " + errorPerfil.message };
  }

  // 2. Asignar rol de investigador por default
  const { data: usuario } = await admin
    .from("usuarios")
    .select("id")
    .eq("email", parsed.data.email)
    .single();

  if (usuario) {
    await admin
      .from("usuario_roles")
      .upsert({ usuario_id: usuario.id, rol: "investigador" }, { onConflict: "usuario_id,rol" });
  }

  // 3. Enviar magic-link
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error: errorOtp } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${appUrl}/api/auth/callback?next=/crear-contrasena`,
      data: {
        nombre: parsed.data.nombre,
        codigo_udg: parsed.data.codigo_udg,
      },
    },
  });
  if (errorOtp) {
    return { ok: false, error: "Error al enviar correo: " + errorOtp.message };
  }

  redirect(`/verifica-correo?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function crearContrasenaAction(formData: FormData): Promise<ActionResult> {
  const parsed = crearContrasenaSchema.safeParse({
    password: formData.get("password"),
    confirmar: formData.get("confirmar"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "No hay sesión activa. Solicita un nuevo enlace." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: error.message };
  }

  // Marcar email_verificado en perfil
  const admin = createAdminClient();
  await admin.from("usuarios").update({ email_verificado: true }).eq("email", user.email!);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function traducirErrorAuth(mensaje: string): string {
  const traducciones: Record<string, string> = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "Email not confirmed": "Tu correo aún no está verificado.",
    "User not found": "No existe una cuenta con ese correo.",
    "Email rate limit exceeded": "Demasiados intentos, espera unos minutos.",
  };
  return traducciones[mensaje] ?? mensaje;
}
