/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mounted under /admin/ via the workspace's path-routing proxy. basePath
  // makes Next.js generate prefixed asset URLs and route paths.
  basePath: "/admin",
  // Self-host friendly: standalone output works with `node .next/standalone/server.js`
  // on any plain Node host. No Vercel runtime required.
  output: "standalone",
  // Allow the dev preview iframe (different origin than localhost).
  experimental: {
    // Next 14 reads this from env at startup; we leave the actions origin
    // unrestricted in dev. In prod, use the deployed origin.
  },
  async redirects() {
    return [
      { source: "/", destination: "/games", permanent: false },
    ];
  },
};

export default nextConfig;
