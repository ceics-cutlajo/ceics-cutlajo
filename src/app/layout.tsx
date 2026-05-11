import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEICS CUTLAJO · Comité de Ética en Investigación en Ciencias de la Salud",
  description:
    "Plataforma del Comité de Ética en Investigación en Ciencias de la Salud, División Salud, Centro Universitario de Tlajomulco, Universidad de Guadalajara.",
  applicationName: "CEICS CUTLAJO",
  authors: [{ name: "CEICS CUTLAJO" }],
};

export const viewport: Viewport = {
  themeColor: "#ed1e77",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
