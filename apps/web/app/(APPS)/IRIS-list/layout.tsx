import type { Metadata } from "next"
import React from "react"
import { SidebarInset } from "@workspace/ui/components/sidebar"
import IrisListNavProvider from "@/components/navigation/providers/iris-list-nav-provider"

export const metadata: Metadata = {
  title: "IRIS List",
  description: "Media tracker",
}

export default function ListLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex h-svh w-full overflow-hidden">
      <IrisListNavProvider>
        <SidebarInset className="no-scrollbar flex flex-1 flex-col overflow-y-auto bg-background pt-0">
          {children}
        </SidebarInset>
      </IrisListNavProvider>
    </div>
  )
}
