"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@workspace/ui/components/direction";
import { IrisSidebarProvider } from "@/components/navigation/sidebar-provider";
import { UserProvider } from "@/context/user-context";
import { EncryptionProvider } from "@/context/encryption-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus={false}
      refetchInterval={0}
      refetchWhenOffline={false}
    >
      <UserProvider>
        <EncryptionProvider>
          <DirectionProvider direction="ltr">
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
              <IrisSidebarProvider>
                {children}
              </IrisSidebarProvider>
            </ThemeProvider>
          </DirectionProvider>
        </EncryptionProvider>
      </UserProvider>
    </SessionProvider>
  );
}
