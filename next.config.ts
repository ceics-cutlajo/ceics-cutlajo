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
};

export default nextConfig;
