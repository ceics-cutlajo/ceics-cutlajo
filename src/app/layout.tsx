import type { Metadata, Viewport } from "next";
import { Barlow, Roboto_Slab } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-barlow",
});

// Serif slab para titulares display, eco de la tipografía institucional del
// manual CUTLAJO. Pesos limitados a los que realmente usamos (700, 800) para
// minimizar el bundle de fuentes.
const robotoSlab = Roboto_Slab({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--font-roboto-slab",
});

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
    <html
      lang="es"
      data-theme="light"
      className={`${barlow.variable} ${robotoSlab.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
