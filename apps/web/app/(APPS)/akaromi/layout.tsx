import type { Metadata } from "next"
import React from "react"
import IrisPassNavProvider from "@/components/navigation/providers/iris-pass-nav-provider"
import { PassProvider } from "@/context/pass-context"

export const metadata: Metadata = {
  title: {
    default: "Akaromi | Vault",
    template: "%s | Akaromi",
  },
  description: "Password manager",
  openGraph: {
    title: "Akaromi | Vault",
    description: "Password manager",
    siteName: "IRIS",
    images: [
      {
        url: "/banners/akaromi.png",
        width: 1200,
        height: 630,
        alt: "Akaromi",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Akaromi | Vault",
    description: "Password manager",
    images: ["/banners/akaromi.png"],
  },
}

export default function PassLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <IrisPassNavProvider>
        <PassProvider>{children}</PassProvider>
      </IrisPassNavProvider>
    </div>
  )
}
