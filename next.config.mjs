/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "bcryptjs", "drizzle-orm"],
  },
};

export default nextConfig;
