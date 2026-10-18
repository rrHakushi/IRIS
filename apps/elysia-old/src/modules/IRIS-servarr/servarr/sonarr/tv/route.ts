import { defineRoute, t } from "@/router"
import {
  isSonarrEnabled,
  parseSonarrTvConfig,
  resolveTvTvdbId,
  SonarrSeriesItemSchema,
} from "@/modules/IRIS-servarr/helpers"

export async function handleSonarrTv({ session, prisma }: any) {
  if (!session.isAuthenticated || !session.user) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message: "Authentication required to access Sonarr TV import feed",
      }),
      { status: 401, headers: { "content-type": "application/json" } }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { settings: true },
  })

  const config = parseSonarrTvConfig(user?.settings)

  if (!isSonarrEnabled(user?.settings) || !config.enabled) {
    return []
  }

  const tvEntries = await prisma.tvList.findMany({
    where: {
      userId: session.user.id,
      status: { in: config.listStatuses },
      tv: {
        status: { in: config.tvStatuses },
      },
    },
    include: {
      tv: true,
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

  for (const entry of tvEntries) {
    const tvdbId = resolveTvTvdbId(entry.tv)
    if (!tvdbId) continue

    results.push({
      title: entry.tv.titlePrimary,
      tvdbId,
      imdbId: entry.tv.imdbId || undefined,
      year: entry.tv.firstAiredYear || undefined,
      monitored: config.monitored,
      seriesType: "standard",
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
    handler: handleSonarrTv,
  },
})
