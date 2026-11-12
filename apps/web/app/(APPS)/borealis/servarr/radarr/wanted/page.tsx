import { Metadata } from "next"
import { ServarrWantedView } from "@Runa/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Radarr > Wanted Movies",
  description:
    "Browse missing monitored movies and quality cutoff unmet releases in Radarr.",
}

export default function RadarrWantedPage() {
  return <ServarrWantedView provider="RADARR" />
}
