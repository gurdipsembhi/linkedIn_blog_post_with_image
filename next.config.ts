import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright drives a real browser process; it must not be bundled by Turbopack.
  serverExternalPackages: ["playwright-core"],
};

export default nextConfig;
