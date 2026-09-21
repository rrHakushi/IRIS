import type { Metadata } from "next"
import React from "react"
import { ServarrMediaView } from "@/components/servarr/servarr-media-view"

export const metadata: Metadata = {
  title: "IRIS List | Sonarr Series",
  description:
    "Browse and manage added TV series from your connected Sonarr instance.",
}

export default function SonarrPage() {
  return (
    <ServarrMediaView
      provider="SONARR"
      pageTitle="Sonarr"
      subtitle="Connected TV series library & monitoring"
    />
  )
}
