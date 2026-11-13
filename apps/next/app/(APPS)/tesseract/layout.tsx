import type { Metadata } from "next"
import React from "react"
import IrisTesseractNavProvider from "@/components/navigation/providers/iris-tesseract-nav-provider"
import { TesseractProvider } from "@/context/tesseract-context"

export const metadata: Metadata = {
  title: {
    default: "Tesseract",
    template: "%s | Tesseract",
  },
  description: "Local-network-only peer-to-peer file, folder, and text sharing",
  openGraph: {
    title: "Tesseract",
    description:
      "Local-network-only peer-to-peer file, folder, and text sharing",
    siteName: "IRIS",
    images: [
      {
        url: "/banners/tesseract.png",
        width: 1200,
        height: 630,
        alt: "Tesseract - Local Peer-to-Peer Share",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tesseract",
    description:
      "Local-network-only peer-to-peer file, folder, and text sharing",
    images: ["/banners/tesseract.png"],
  },
}

export default function TesseractLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <TesseractProvider>
        <IrisTesseractNavProvider>{children}</IrisTesseractNavProvider>
      </TesseractProvider>
    </div>
  )
}

