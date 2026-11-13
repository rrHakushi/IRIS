import { Metadata } from "next"
import { ServarrBlocklistView } from "@NamelessLiberty/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Sonarr > Blocklist",
  description: "Manage blacklisted and rejected releases in Sonarr.",
}

export default function SonarrBlocklistPage() {
  return <ServarrBlocklistView provider="SONARR" />
}
