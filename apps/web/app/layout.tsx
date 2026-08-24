import { Geist_Mono, Instrument_Sans, Oxanium } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "next-themes"
import { cn } from "@workspace/ui/lib/utils";
import React from "react";
import { DirectionProvider } from "@workspace/ui/components/direction";

const oxaniumHeading = Oxanium({ subsets: ['latin'], variable: '--font-heading' });

const instrumentSans = Instrument_Sans({ subsets: ['latin'], variable: '--font-sans' })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", instrumentSans.variable, oxaniumHeading.variable)}
    >
      <body>
        <DirectionProvider direction="ltr">

          <ThemeProvider>{children}</ThemeProvider>
        </DirectionProvider>
      </body>
    </html>
  )
}
