import { Metadata } from "next"
import { ServarrBlocklistView } from "@/components/servarr/servarr-blocklist-view"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Radarr > Blocklist",
  description: "Manage blacklisted and rejected releases in Radarr.",
}

export default function RadarrBlocklistPage() {
  return <ServarrBlocklistView provider="RADARR" />
}
