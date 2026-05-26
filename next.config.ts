import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep @napi-rs/canvas and pdfjs-dist as external so their native binaries work in serverless
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async redirects() {
    return [
      // URL amigable para San Diego La Revista → listado de ediciones
      {
        source: '/sandiego-revistas',
        destination: '/revistas/san-diego-la-revista',
        permanent: false,
      },
      // URL amigable para una edición específica
      {
        source: '/sandiego-revistas/:numero',
        destination: '/revistas/san-diego-la-revista/:numero',
        permanent: false,
      },
    ]
  },
};

export default nextConfig;
