import { Metadata } from "next"
import { ServarrHistoryView } from "@Runa/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Sonarr > History",
  description:
    "View grab, import, upgrade, and file modification event logs from Sonarr.",
}

export default function SonarrHistoryPage() {
  return <ServarrHistoryView provider="SONARR" />
}
