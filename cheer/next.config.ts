import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// cheer/ is its own app inside the side-quest-philly repo, which has its own
// lockfile one level up. Pin the workspace root here so Next doesn't infer the
// parent repo (and warn about multiple lockfiles), locally and on Vercel.
const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
