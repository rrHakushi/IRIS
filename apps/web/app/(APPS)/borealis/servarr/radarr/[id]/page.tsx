import { Metadata } from "next"
import { ServarrMovieDetailView } from "@Runa/borealis"

export const metadata: Metadata = {
  title: "Borealis | Servarr > Radarr > Movie Details",
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
