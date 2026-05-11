import { redirect } from "next/navigation";

export default function Home() {
  // El middleware redirige autenticados a /dashboard.
  // No autenticados llegan aquí y los mandamos a /login.
  redirect("/login");
}
