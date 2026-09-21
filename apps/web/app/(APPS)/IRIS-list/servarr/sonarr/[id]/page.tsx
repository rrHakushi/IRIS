import { Metadata } from "next"
import { ServarrSeriesDetailView } from "@/components/servarr/servarr-series-detail-view"

export const metadata: Metadata = {
  title: "Series Details | Sonarr | IRIS",
  description:
    "View series seasons, episodes, files, codec specs, and run interactive release searches.",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SonarrSeriesDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const seriesId = parseInt(resolvedParams.id, 10)
  return <ServarrSeriesDetailView seriesId={seriesId} />
}
