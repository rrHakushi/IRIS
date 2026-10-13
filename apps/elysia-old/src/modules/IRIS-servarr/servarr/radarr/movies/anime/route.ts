import { defineRoute, t } from "@/router"
import {
  isRadarrEnabled,
  parseRadarrAnimeConfig,
  resolveAnimeTmdbId,
  resolveAnimeImdbId,
  RadarrMovieItemSchema,
} from "@/modules/IRIS-servarr/helpers"

export async function handleRadarrAnimeMovies({ session, prisma }: any) {
  if (!session.isAuthenticated || !session.user) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message:
          "Authentication required to access Radarr Anime Movies import feed",
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { settings: true },
  })

  const config = parseRadarrAnimeConfig(user?.settings)

  if (!isRadarrEnabled(user?.settings) || !config.enabled) {
    return []
  }

  const animeEntries = await prisma.animeList.findMany({
    where: {
      userId: session.user.id,
      status: { in: config.listStatuses },
      anime: {
        format: { in: config.animeMovieFormats },
        status: { in: config.animeStatuses },
      },
    },
    include: {
      anime: true,
    },
  })

  const results: Array<{
    title: string
    tmdbId?: number
    imdbId?: string
    year?: number
    monitored: boolean
    hasFile: boolean
  }> = []

  for (const entry of animeEntries) {
    const tmdbId = resolveAnimeTmdbId(entry.anime)
    const imdbId = resolveAnimeImdbId(entry.anime)

    // In Radarr, a movie needs either a TMDB ID or IMDB ID for identification
    if (!tmdbId && !imdbId) continue

    results.push({
      title: entry.anime.titlePrimary,
      tmdbId: tmdbId || undefined,
      imdbId: imdbId || undefined,
      year: entry.anime.startDateYear || undefined,
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
    handler: handleRadarrAnimeMovies,
  },
})
