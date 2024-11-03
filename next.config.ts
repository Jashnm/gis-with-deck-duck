import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['duckdb', 'duckdb-async'],
};

export default nextConfig;
