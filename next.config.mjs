/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["pg", "ioredis", "bullmq", "twilio", "bcryptjs"],
    serverActions: {
      // CSRF protection: only allow server action requests whose Origin header
      // matches the Host header OR one of the domains listed here.
      // Next.js 14.2+ checks Origin vs Host on every server action call and
      // rejects mismatches unless the origin appears in this list.
      // This list supplements the automatic same-origin check — add domains
      // here when the app is accessed through reverse proxies, CDNs, or
      // alternative hostnames where Origin and Host may legitimately differ.
      allowedOrigins: [
        "civictext.com",
        "www.civictext.com",
        "staging.civictext.com",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
