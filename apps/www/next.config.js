/*
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "pbs.twimg.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
    ],
  },
  // Prevent Turbopack from externalizing Shiki and Basehub's Shiki deps,
  // which avoids cross-version resolution warnings and missing wasm-inlined modules.
  transpilePackages: [
    "basehub",
    "shiki",
    "@shikijs/core",
    "@shikijs/engine-oniguruma",
    "@shikijs/engine-javascript",
    "@shikijs/types",
    "@shikijs/vscode-textmate",
  ],
};

export default nextConfig;
