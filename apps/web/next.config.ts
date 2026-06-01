import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// One key file for the whole monorepo: load the root .env.local so the web
// app and the scripts read the SAME keys. Local values win over anything
// already set. (Root file is gitignored.)
loadEnv({ path: resolve(process.cwd(), "../../.env.local") });

const nextConfig: NextConfig = {
  // Transpile the workspace engine package (TS source, no build step).
  transpilePackages: ["@orenda/engine"],
};

export default nextConfig;
