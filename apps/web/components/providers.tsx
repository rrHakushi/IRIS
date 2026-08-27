"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@workspace/ui/components/direction";

import { UserProvider } from "@/context/user-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <UserProvider>
        <DirectionProvider direction="ltr">
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </DirectionProvider>
      </UserProvider>
    </SessionProvider>
  );
}
