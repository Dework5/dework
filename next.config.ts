import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Next.js 15+: serverExternalPackages (ya no es experimental)
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
