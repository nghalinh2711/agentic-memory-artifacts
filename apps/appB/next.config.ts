import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  allowedDevOrigins: ['vaguely-plural-pushpin.ngrok-free.dev'],
};

export default nextConfig;
