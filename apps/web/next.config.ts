import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const apiUrl = rawApiUrl.replace(/\$\{ELYSIA_PORT\}|\$ELYSIA_PORT/g, "4000");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@workspace/ui"],
  async rewrites() {
    return [
      {
        source: "/public/:path*",
        destination: `${apiUrl}/public/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
