import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

/** Monorepo root `.env` — Next only loads `apps/web/.env*` by default. */
const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
dotenv.config({ path: path.join(monorepoRoot, ".env") });
dotenv.config({ path: path.join(monorepoRoot, ".env.local"), override: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    proxyClientMaxBodySize: "100mb"
  }
};

export default nextConfig;

