import { Metadata } from "next"
import { ServarrHistoryView } from "@/components/servarr/servarr-history-view"

export const metadata: Metadata = {
  title: "History | Radarr | IRIS",
  description:
    "View grab, import, upgrade, and file modification event logs from Radarr.",
}

export default function RadarrHistoryPage() {
  return <ServarrHistoryView provider="RADARR" />
}
