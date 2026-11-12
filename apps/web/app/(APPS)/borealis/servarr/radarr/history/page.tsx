import { Metadata } from "next"
import { ServarrHistoryView } from "@Runa/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Radarr > History",
  description:
    "View grab, import, upgrade, and file modification event logs from Radarr.",
}

export default function RadarrHistoryPage() {
  return <ServarrHistoryView provider="RADARR" />
}
