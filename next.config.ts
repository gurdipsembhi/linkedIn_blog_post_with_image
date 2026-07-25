import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright drives a real browser process; it must not be bundled by Turbopack.
  // @sparticuz/chromium ships a binary (brotli .br files) that likewise must stay
  // external so its assets are traced into the serverless function on Vercel.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
};

export default nextConfig;
