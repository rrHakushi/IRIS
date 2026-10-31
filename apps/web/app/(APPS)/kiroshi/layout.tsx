import type { Metadata } from "next"
import React from "react"
import IrisSearchNavProvider from "@/components/navigation/providers/iris-search-nav-provider"

export const metadata: Metadata = {
  title: {
    default: "Kiroshi | Search",
    template: "%s | Kiroshi",
  },
  description: "Web search engine",
  openGraph: {
    title: "Kiroshi | Search",
    description: "Web search engine",
    siteName: "IRIS",
    images: [
      {
        url: "/banners/kiroshi.png",
        width: 1200,
        height: 630,
        alt: "Kiroshi - Web search engine",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kiroshi | Search",
    description: "Web search engine",
    images: ["/banners/kiroshi.png"],
  },
  other: {
    "search-opensearch": "/opensearch.xml",
  },
}

export default function SearchLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <link
        rel="search"
        type="application/opensearchdescription+xml"
        title="Kiroshi"
        href="/opensearch.xml"
      />
      <IrisSearchNavProvider>{children}</IrisSearchNavProvider>
    </div>
  )
}
