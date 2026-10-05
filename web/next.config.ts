import type { NextConfig } from "next"

// Server-side address of the FastAPI control plane. Browser requests go to
// /api/* on this origin and are proxied, so no CORS setup is needed.
const API_URL = process.env.API_URL ?? "http://localhost:8000"

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }]
  },
}

export default nextConfig
