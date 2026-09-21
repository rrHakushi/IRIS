import { Metadata } from "next"
import { ServarrHistoryView } from "@/components/servarr/servarr-history-view"

export const metadata: Metadata = {
  title: "History | Sonarr | IRIS",
  description:
    "View grab, import, upgrade, and file modification event logs from Sonarr.",
}

export default function SonarrHistoryPage() {
  return <ServarrHistoryView provider="SONARR" />
}
