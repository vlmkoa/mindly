/** @type {import('next').NextConfig} */

// All /api/* requests are proxied to the FastAPI backend (Docker, port 8000).
// Same-origin from the browser's perspective → session cookie just works,
// no CORS configuration needed anywhere.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  // Self-contained server bundle for the production container (Dockerfile.web
  // copies .next/standalone + .next/static + public). Note: standalone
  // serializes this config at BUILD time, so the rewrite below is frozen into
  // the image — in production the Traefik ingress does the /api split and the
  // rewrite is dead code by design. It remains the dev proxy.
  output: "standalone",
  // No next/image anywhere in the app — disable the optimizer so the
  // /_next/image endpoint (and its sharp/libvips attack surface, see
  // npm audit) doesn't exist at all.
  images: { unoptimized: true },
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
