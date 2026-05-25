import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["cheerio", "axios"],
  },
};

export default nextConfig;
