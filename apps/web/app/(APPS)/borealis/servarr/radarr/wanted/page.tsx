import { Metadata } from "next"
import { ServarrWantedView } from "@/components/servarr/servarr-wanted-view"

export const metadata: Metadata = {
  title: "Wanted Movies | Radarr | IRIS",
  description:
    "Browse missing monitored movies and quality cutoff unmet releases in Radarr.",
}

export default function RadarrWantedPage() {
  return <ServarrWantedView provider="RADARR" />
}
