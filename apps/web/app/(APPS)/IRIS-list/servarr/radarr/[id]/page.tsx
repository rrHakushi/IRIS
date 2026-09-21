import { Metadata } from "next"
import { ServarrMovieDetailView } from "@/components/servarr/servarr-movie-detail-view"

export const metadata: Metadata = {
  title: "Movie Details | Radarr | IRIS",
  description:
    "View movie media specifications, files, and perform interactive release searches.",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RadarrMovieDetailPage({ params }: PageProps) {
  const resolvedParams = await params
  const movieId = parseInt(resolvedParams.id, 10)
  return <ServarrMovieDetailView movieId={movieId} />
}
