"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { RouterProvider } from "react-aria-components"
import { SessionProvider } from "@/context/session-context"
import { DirectionProvider } from "@workspace/ui/components/direction"
import { IrisSidebarProvider } from "@/components/navigation/sidebar-provider"
import { UserProvider } from "@/context/user-context"
import { EncryptionProvider } from "@/context/encryption-context"
import { WebSocketProvider } from "@/context/websocket-context"
import { NotificationProvider } from "@/context/notification-context"
import { Toaster } from "@/components/ui/sonner"
import { LastAppTracker } from "@/components/navigation/last-app-tracker"

import dynamic from "next/dynamic"

const MetadataDevTool =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("@/components/dev/metadata-dev-tool").then(
            (m) => m.MetadataDevTool
          ),
        { ssr: false }
      )
    : () => null

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >
  }
}

if (typeof window !== "undefined") {
  ;(window as any).__IRIS_API_URL__ = `${window.location.origin}/elysia`
}

// Suppress false-positive React 19 / Next.js 16 warnings from browser extension attribute injection
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const origError = console.error
  console.error = (...args: unknown[]) => {
    const firstArg = typeof args[0] === "string" ? args[0] : ""
    if (
      firstArg.includes("data-akaromi-attached") ||
      firstArg.includes("akaromi")
    ) {
      return
    }
    origError.apply(console, args)
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <RouterProvider navigate={router.push}>
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
                  <IrisSidebarProvider>{children}</IrisSidebarProvider>
                  <Toaster closeButton position="top-center" />
                  {process.env.NODE_ENV === "development" && (
                    <MetadataDevTool />
                  )}
                </DirectionProvider>
              </NotificationProvider>
            </WebSocketProvider>
          </EncryptionProvider>
        </UserProvider>
      </SessionProvider>
    </RouterProvider>
  )
}
