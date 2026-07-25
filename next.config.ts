import type { NextConfig } from "next";

// playwright-core and @sparticuz/chromium lazily require/read files (e.g.
// playwright-core/browsers.json, chromium's brotli .br binaries) through paths
// Next's static tracer can't follow, so they get omitted from the serverless
// bundle and the route 500s with "Cannot find module …/browsers.json". Force the
// full packages into every function that actually renders an image.
const RENDER_DEPS = [
  "./node_modules/playwright-core/**",
  "./node_modules/@sparticuz/chromium/**",
];

const nextConfig: NextConfig = {
  // Playwright drives a real browser process; it must not be bundled by Turbopack.
  // @sparticuz/chromium ships a binary that likewise must stay external.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  // Only the image-rendering routes load Playwright (see lib/render.ts); every
  // other route was decoupled so it never pulls this heavy chain in.
  outputFileTracingIncludes: {
    "/api/image": RENDER_DEPS,
    "/api/schedule/run": RENDER_DEPS,
    "/api/cron": RENDER_DEPS,
  },
};

export default nextConfig;
