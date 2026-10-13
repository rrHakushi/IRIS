import { Metadata } from "next"
import { ServarrQueueView } from "@/components/servarr/servarr-queue-view"

export const metadata: Metadata = {
  title: "Sonarr Activity Queue | IRIS",
  description: "Live downloads and activity queue for Sonarr.",
}

export default function SonarrQueuePage() {
  return <ServarrQueueView provider="SONARR" />
}
