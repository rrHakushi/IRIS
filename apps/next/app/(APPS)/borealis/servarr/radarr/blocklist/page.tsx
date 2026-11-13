import { Metadata } from "next"
import { ServarrBlocklistView } from "@NamelessLiberty/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Radarr > Blocklist",
  description: "Manage blacklisted and rejected releases in Radarr.",
}

export default function RadarrBlocklistPage() {
  return <ServarrBlocklistView provider="RADARR" />
}
