/** @type {import('next').NextConfig} */

// All /api/* requests are proxied to the FastAPI backend (Docker, port 8000).
// Same-origin from the browser's perspective → session cookie just works,
// no CORS configuration needed anywhere.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
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
