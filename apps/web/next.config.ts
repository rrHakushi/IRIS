import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
const apiUrl = rawApiUrl.replace(/\$\{ELYSIA_PORT\}|\$ELYSIA_PORT/g, "4000")

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ["@workspace/ui"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.anilist.co" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "**.simkl.in" },
      { protocol: "https", hostname: "**.thetvdb.com" },
      { protocol: "https", hostname: "images.igdb.com" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "**.deezer.com" },
      { protocol: "https", hostname: "lastfm.freetls.fastly.net" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/public/:path*",
        destination: `${apiUrl}/public/:path*`,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
