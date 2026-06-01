import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// LOCAL DEV ONLY: one key file for the whole monorepo — load the root
// .env.local so the web app and scripts read the SAME keys. On Vercel this
// file does not exist (it's gitignored); env vars come from the Vercel
// project settings instead. Guarded so a missing file is a no-op, not a crash.
const rootEnv = resolve(process.cwd(), "../../.env.local");
if (existsSync(rootEnv)) loadEnv({ path: rootEnv });

const nextConfig: NextConfig = {
  // Transpile the workspace engine package (TS source, no build step).
  transpilePackages: ["@orenda/engine"],
};

export default nextConfig;
