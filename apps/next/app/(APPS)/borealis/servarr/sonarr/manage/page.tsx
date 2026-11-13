import { Metadata } from "next"
import { ServarrSeriesManageView } from "@NamelessLiberty/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Sonarr > Manage Series",
  description:
    "Mass manage series, edit monitored status, inspect files, and interactive release search.",
}

export default function SonarrManagePage() {
  return <ServarrSeriesManageView provider="SONARR" />
}
