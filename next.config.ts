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
  // pdfkit carga sus archivos .afm (Adobe Font Metrics) al runtime con fs.readFile.
  // Next.js no los detecta como dependencias estáticas, así que hay que incluirlos
  // explícitamente en el bundle serverless de Vercel para la server action que
  // genera el acta. Sin esto: ENOENT en /presidencia/dictamen/* al emitir.
  outputFileTracingIncludes: {
    "/presidencia/dictamen/**": [
      "./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**",
      "./node_modules/pdfkit/js/data/**",
    ],
    "/**": [
      "./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**",
      "./node_modules/pdfkit/js/data/**",
    ],
  },
};

export default nextConfig;
