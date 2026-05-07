import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Windows + persistent webpack cache corrupts .next regularly during HMR.
  // Force in-memory cache during dev to keep file-watcher races off disk.
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: "memory" }
    }
    return config
  },
}

export default nextConfig
