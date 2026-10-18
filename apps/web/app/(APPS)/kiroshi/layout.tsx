import type { Metadata } from "next"
import React from "react"
import IrisSearchNavProvider from "@/components/navigation/providers/iris-search-nav-provider"

export const metadata: Metadata = {
  title: "Kiroshi | Search",
  description: "Web & Meta Search.",
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
