import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Both packages are external so Turbopack never bundles them.
  // External packages are lazily loaded on first import() call — this means
  // we control the init order inside the POST handler:
  //   1. import('@napi-rs/canvas') → sets globalThis.Path2D + DOMMatrix
  //   2. import('pdfjs-dist/...')  → pdfjs module init runs NOW, sees our globals ✓
  // If pdfjs-dist were bundled, Turbopack could evaluate it at Lambda cold-start
  // BEFORE our import() fires, so it would capture undefined Path2D.
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

  // Rewrite: la URL del browser se queda en /san-diego-la-revistas
  // pero Next.js sirve el contenido de /revistas/san-diego-la-revista/139
  async rewrites() {
    return [
      {
        source: '/san-diego-la-revistas',
        destination: '/revistas/san-diego-la-revista/139',
      },
    ]
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
      './node_modules/@napi-rs/canvas/**/*',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**/*',
      './node_modules/pdfjs-dist/legacy/build/**/*',
    ],
  },
});

export default nextConfig;
