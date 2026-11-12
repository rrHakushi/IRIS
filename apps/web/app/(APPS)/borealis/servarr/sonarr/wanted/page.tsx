import { Metadata } from "next"
import { ServarrWantedView } from "@Runa/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Sonarr > Wanted Episodes",
  description:
    "Browse missing monitored episodes and quality cutoff unmet releases in Sonarr.",
}

export default function SonarrWantedPage() {
  return <ServarrWantedView provider="SONARR" />
}
