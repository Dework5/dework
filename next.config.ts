import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep @napi-rs/canvas and pdfjs-dist as external so their native binaries work in serverless
  serverExternalPackages: ['canvas', 'pdfjs-dist'],

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

// outputFileTracingIncludes is valid at runtime but not in Next.js TS types.
// It forces Vercel's file tracer to bundle the @napi-rs/canvas native binary
// and pdfjs-dist worker inside the /api/render-issue serverless function.
Object.assign(nextConfig, {
  outputFileTracingIncludes: {
    '/api/render-issue': [
      './node_modules/canvas/**/*',
      './node_modules/pdfjs-dist/build/**/*',
    ],
  },
});

export default nextConfig;
