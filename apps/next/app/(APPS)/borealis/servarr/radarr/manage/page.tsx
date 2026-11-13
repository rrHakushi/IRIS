import { Metadata } from "next"
import { ServarrSeriesManageView } from "@NamelessLiberty/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Radarr > Manage Movies",
  description:
    "Mass manage movies, edit monitored status, inspect files, and interactive release search.",
}

export default function RadarrManagePage() {
  return <ServarrSeriesManageView provider="RADARR" />
}
