import { Geist_Mono, Instrument_Sans, Oxanium } from "next/font/google"
import "@workspace/ui/globals.css"
import "./globals.css"
import { cn } from "@workspace/ui/lib/utils"
import React from "react"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getMessages } from "next-intl/server"
import { Providers } from "@/components/providers"
import { Metadata } from "next"

const oxaniumHeading = Oxanium({
  subsets: ["latin"],
  variable: "--font-heading",
})
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
})
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "IRIS",
  description:
    "Collection of self hosted apps https://github.com/rrHakushi/IRIS",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        instrumentSans.variable,
        oxaniumHeading.variable
      )}
    >
      <body
        suppressHydrationWarning
        className="min-h-svh bg-background text-foreground selection:bg-primary/20 selection:text-primary"
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
