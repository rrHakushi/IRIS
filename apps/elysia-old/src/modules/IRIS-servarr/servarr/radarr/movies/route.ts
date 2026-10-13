import { defineRoute, t } from "@/router"
import {
  isRadarrEnabled,
  parseRadarrMovieConfig,
  resolveMovieTmdbId,
  RadarrMovieItemSchema,
} from "@/modules/IRIS-servarr/helpers"

export async function handleRadarrMovies({ session, prisma }: any) {
  if (!session.isAuthenticated || !session.user) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required to access Radarr Movies import feed",
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { settings: true },
  })

  const config = parseRadarrMovieConfig(user?.settings)

  if (!isRadarrEnabled(user?.settings) || !config.enabled) {
    return []
  }

  const movieEntries = await prisma.movieList.findMany({
    where: {
      userId: session.user.id,
      status: { in: config.listStatuses },
      movie: {
        status: { in: config.movieStatuses },
      },
    },
    include: {
      movie: true,
    },
  })

  const results: Array<{
    title: string
    tmdbId: number
    imdbId?: string
    year?: number
    monitored: boolean
    hasFile: boolean
  }> = []

  for (const entry of movieEntries) {
    const tmdbId = resolveMovieTmdbId(entry.movie)
    if (!tmdbId) continue

    results.push({
      title: entry.movie.titlePrimary,
      tmdbId,
      imdbId: entry.movie.imdbId || undefined,
      year: entry.movie.releaseDateYear || undefined,
      monitored: config.monitored,
      hasFile: entry.status === "COMPLETED",
    })
  }

  return results
}

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Array(RadarrMovieItemSchema),
      },
    },
    handler: handleRadarrMovies,
  },
})
