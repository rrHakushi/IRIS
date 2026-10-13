import type { Metadata } from "next"
import React from "react"
import IrisPassNavProvider from "@/components/navigation/providers/iris-pass-nav-provider"
import { PassProvider } from "@/context/pass-context"

export const metadata: Metadata = {
  title: "IRIS Pass | Vault",
  description: "Encrypted password manager and more.",
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
