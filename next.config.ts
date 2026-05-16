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
  // resolvidos relativo al __dirname del módulo. Next/Turbopack al bundlear pierde
  // ese path y los archivos no se incluyen. Solución doble:
  //   1. serverExternalPackages: deja a pdfkit fuera del bundle (require nativo)
  //   2. outputFileTracingIncludes: garantiza que los AFM viajen al runtime serverless
  serverExternalPackages: ["pdfkit"],
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
