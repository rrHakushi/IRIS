import { defineRoute, t } from "@/router"
import {
  isSonarrEnabled,
  parseSonarrAnimeConfig,
  resolveAnimeTvdbId,
  resolveAnimeImdbId,
  SonarrSeriesItemSchema,
} from "@/modules/IRIS-servarr/helpers"

export async function handleSonarrAnime({ session, prisma }: any) {
  if (!session.isAuthenticated || !session.user) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required to access Sonarr import feed",
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { settings: true },
  })

  const config = parseSonarrAnimeConfig(user?.settings)

  if (!isSonarrEnabled(user?.settings) || !config.enabled) {
    return []
  }

  const animeEntries = await prisma.animeList.findMany({
    where: {
      userId: session.user.id,
      status: { in: config.listStatuses },
      anime: {
        format: { in: config.animeFormats },
        status: { in: config.animeStatuses },
      },
    },
    include: {
      anime: true,
    },
  })

  const results: Array<{
    title: string
    tvdbId: number
    imdbId?: string
    year?: number
    monitored: boolean
    seriesType: "anime" | "standard"
    seasonFolder: boolean
  }> = []

  for (const entry of animeEntries) {
    const tvdbId = resolveAnimeTvdbId(entry.anime)
    if (!tvdbId) continue

    const imdbId = resolveAnimeImdbId(entry.anime)

    results.push({
      title: entry.anime.titlePrimary,
      tvdbId,
      imdbId: imdbId || undefined,
      year: entry.anime.startDateYear || undefined,
      monitored: config.monitored,
      seriesType: "anime",
      seasonFolder: true,
    })
  }

  return results
}

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: t.Array(SonarrSeriesItemSchema),
      },
    },
    handler: handleSonarrAnime,
  },
})
