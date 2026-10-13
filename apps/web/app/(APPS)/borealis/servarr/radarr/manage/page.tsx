import { Metadata } from "next"
import { ServarrSeriesManageView } from "@/components/servarr/servarr-series-manage-view"

export const metadata: Metadata = {
  title: "Manage Movies | Radarr | IRIS",
  description:
    "Mass manage movies, edit monitored status, inspect files, and interactive release search.",
}

export default function RadarrManagePage() {
  return <ServarrSeriesManageView provider="RADARR" />
}
