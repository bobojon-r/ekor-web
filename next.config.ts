import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Самодостаточная сборка для Docker-образа (server.js + минимум node_modules)
  output: 'standalone',
  poweredByHeader: false,
};

export default nextConfig;
