import type { Metadata } from "next"
import React from "react"
import { ServarrMediaView } from "@Runa/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Radarr > Movies",
  description:
    "Browse and manage added movies from your connected Radarr instance.",
}

export default function RadarrPage() {
  return (
    <ServarrMediaView
      provider="RADARR"
      pageTitle="Radarr"
      subtitle="Connected movie library & monitoring"
    />
  )
}
