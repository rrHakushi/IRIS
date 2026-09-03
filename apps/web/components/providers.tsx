"use client"

import * as React from "react"
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
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
  )
}
