import { Metadata } from "next"
import { ServarrBlocklistView } from "@/components/servarr/servarr-blocklist-view"

export const metadata: Metadata = {
  title: "Blocklist | Sonarr | IRIS",
  description: "Manage blacklisted and rejected releases in Sonarr.",
}

export default function SonarrBlocklistPage() {
  return <ServarrBlocklistView provider="SONARR" />
}
