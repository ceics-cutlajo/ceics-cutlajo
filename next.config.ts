import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  experimental: {
    // Next.js limita Server Actions a 1 MB de body por defecto. Los protocolos
    // (PDF/.docx) llegan hasta 4 MB. Vercel Hobby tiene cap duro ~4.5 MB de body,
    // así que '4mb' es el máximo seguro sin pasar a subida directa a Storage.
    serverActions: { bodySizeLimit: "4mb" },
  },
  // pdfkit carga sus archivos .afm (Adobe Font Metrics) al runtime con fs.readFile
  // resolvidos relativo al __dirname del módulo. Si Next/Turbopack lo bundlea pierde
  // ese path y los archivos no se encuentran (ENOENT en Vercel). Solución:
  // sacar pdfkit del bundle con serverExternalPackages — el runtime hace require
  // nativo que sí resuelve los AFM. NO usar outputFileTracingIncludes con paths
  // que pasen por .pnpm/ — son symlinks y Vercel rechaza el deploy.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
