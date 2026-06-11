import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Barlow para todo el sistema (titulares en pesos fuertes, cuerpo en
// regulares); ver docs/design.md §4.
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "CEICS CUTLAJO · Comité de Ética en Investigación en Ciencias de la Salud",
  description:
    "Plataforma del Comité de Ética en Investigación en Ciencias de la Salud, División Salud, Centro Universitario de Tlajomulco, Universidad de Guadalajara.",
  applicationName: "CEICS CUTLAJO",
  authors: [{ name: "CEICS CUTLAJO" }],
};

export const viewport: Viewport = {
  themeColor: "#27334F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="light" className={barlow.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
