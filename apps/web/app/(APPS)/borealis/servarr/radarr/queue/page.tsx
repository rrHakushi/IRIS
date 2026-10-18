import { Metadata } from "next"
import { ServarrQueueView } from "@/components/servarr/servarr-queue-view"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Radarr > Activity Queue",
  description: "Live downloads and activity queue for Radarr.",
}

export default function RadarrQueuePage() {
  return <ServarrQueueView provider="RADARR" />
}
