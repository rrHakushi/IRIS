"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RouterProvider } from "react-aria-components"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "next-themes"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { IrisSidebarProvider } from "@/components/navigation/sidebar-provider"
import { UserProvider } from "@/context/user-context"
import { EncryptionProvider } from "@/context/encryption-context"
import { WebSocketProvider } from "@/context/websocket-context"
import { NotificationProvider } from "@/context/notification-context"
import { Toaster } from "@/components/ui/sonner"
import { LastAppTracker } from "@/components/navigation/last-app-tracker"

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <RouterProvider navigate={(to, options) => router.push(to, options)}>
      <SessionProvider
        refetchOnWindowFocus={false}
        refetchInterval={0}
        refetchWhenOffline={false}
      >
        <LastAppTracker />
        <UserProvider>
          <EncryptionProvider>
            <WebSocketProvider>
              <NotificationProvider>
                <DirectionProvider direction="ltr">
                  <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                  >
                    <IrisSidebarProvider>{children}</IrisSidebarProvider>
                    <Toaster closeButton position="top-center" />
                  </ThemeProvider>
                </DirectionProvider>
              </NotificationProvider>
            </WebSocketProvider>
          </EncryptionProvider>
        </UserProvider>
      </SessionProvider>
    </RouterProvider>
  )
}
