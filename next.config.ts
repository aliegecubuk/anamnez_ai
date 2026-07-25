import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Multiple lockfiles exist above this repo (user home dir); pin the tracing root
  // so Next doesn't infer C:\Users\Gaming and trace the whole home directory.
  outputFileTracingRoot: path.join(__dirname),
  // Windows + persistent webpack cache corrupts .next regularly during HMR.
  // Force in-memory cache during dev to keep file-watcher races off disk.
  // (Only applies to webpack builds; `next dev --turbopack` ignores this.)
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: "memory" }
    }
    return config
  },
}

export default nextConfig
