import type { Metadata } from "next"
import React from "react"

export const metadata: Metadata = {
  title: {
    default: "Carina | Identity",
    template: "%s | Carina",
  },
  description: "Identity management",
  openGraph: {
    title: "Carina | Identity",
    description: "Identity management",
    siteName: "IRIS",
    images: [
      {
        url: "/banners/carina.png",
        width: 1200,
        height: 630,
        alt: "Carina - Identity management",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Carina | Identity",
    description: "Identity management",
    images: ["/banners/carina.png"],
  },
}

export default function CarinaLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <>{children}</>
}

