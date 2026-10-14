import type { Metadata } from "next"
import React from "react"

export const metadata: Metadata = {
  title: "Kiroshi | Search",
  description: "Privacy-focused meta-search powered by SearXNG.",
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
    <div className="flex h-svh w-full flex-col overflow-y-auto">
      <link
        rel="search"
        type="application/opensearchdescription+xml"
        title="Kiroshi"
        href="/opensearch.xml"
      />
      {children}
    </div>
  )
}
