import { Metadata } from "next"
import { ServarrSeriesManageView } from "@/components/servarr/servarr-series-manage-view"

export const metadata: Metadata = {
  title: "Manage Series | Sonarr | IRIS",
  description:
    "Mass manage series, edit monitored status, inspect files, and interactive release search.",
}

export default function SonarrManagePage() {
  return <ServarrSeriesManageView provider="SONARR" />
}
