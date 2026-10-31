import type { Metadata } from "next"
import React from "react"
import IrisListNavProvider from "@/components/navigation/providers/iris-list-nav-provider"

export const metadata: Metadata = {
  title: {
    default: "Borealis",
    template: "%s | Borealis",
  },
  description: "Media library and tracking",
  openGraph: {
    title: "Borealis",
    description: "Media library and tracking",
    siteName: "IRIS",
    images: [
      {
        url: "/banners/borealis.png",
        width: 1200,
        height: 630,
        alt: "Borealis - Media library and tracking",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Borealis",
    description: "Media library and tracking",
    images: ["/banners/borealis.png"],
  },
}

export default function ListLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <IrisListNavProvider>
        {children}
      </IrisListNavProvider>
    </div>
  )
}
