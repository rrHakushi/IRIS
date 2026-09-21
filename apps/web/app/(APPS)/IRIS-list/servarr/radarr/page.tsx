import type { Metadata } from "next"
import React from "react"
import { ServarrMediaView } from "@/components/servarr/servarr-media-view"

export const metadata: Metadata = {
  title: "IRIS List | Radarr Movies",
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
