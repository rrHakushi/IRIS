import { defineRoute, t } from "@/router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionCredentials,
} from "@IRIS/connections"

export const SonarrMediaItemSchema = t.Object({
  id: t.Union([t.String(), t.Number()]),
  title: t.String(),
  originalTitle: t.Optional(t.Nullable(t.String())),
  year: t.Optional(t.Nullable(t.Number())),
  overview: t.Optional(t.Nullable(t.String())),
  monitored: t.Boolean(),
  hasFile: t.Optional(t.Boolean()),
  qualityProfile: t.Optional(t.Nullable(t.String())),
  qualityProfileId: t.Optional(t.Nullable(t.Number())),
  sizeOnDisk: t.Optional(t.Nullable(t.Number())),
  status: t.Optional(t.Nullable(t.String())),
  added: t.Optional(t.Nullable(t.String())),
  posterUrl: t.Optional(t.Nullable(t.String())),
  fanartUrl: t.Optional(t.Nullable(t.String())),
  tvdbId: t.Optional(t.Nullable(t.Number())),
  imdbId: t.Optional(t.Nullable(t.String())),
  path: t.Optional(t.Nullable(t.String())),
  genres: t.Optional(t.Nullable(t.Array(t.String()))),
  episodeCount: t.Optional(t.Nullable(t.Number())),
  episodeFileCount: t.Optional(t.Nullable(t.Number())),
  seasonCount: t.Optional(t.Nullable(t.Number())),
})

export const SonarrLibraryResponseSchema = t.Object({
  success: t.Boolean(),
  connected: t.Boolean(),
  provider: t.String(),
  hostUrl: t.Optional(t.Nullable(t.String())),
  isLocalFallback: t.Optional(t.Boolean()),
  items: t.Array(SonarrMediaItemSchema),
  totalCount: t.Number(),
  message: t.Optional(t.String()),
})

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: SonarrLibraryResponseSchema,
      },
      detail: {
        summary: "Get Sonarr added TV series library",
        description:
          "Fetches all added TV series directly from the connected Sonarr instance with local database fallback.",
        tags: ["Servarr", "Sonarr"],
      },
    },

    async handler({ session, prisma }: any) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
            message: "Authentication required",
          }),
          { status: 401, headers: { "content-type": "application/json" } }
        )
      }

      const connection = await prisma.connection.findFirst({
        where: {
          userId: session.user.id,
          provider: "SONARR",
          status: "CONNECTED",
        },
      })

      if (!connection) {
        return {
          success: true,
          connected: false,
          provider: "SONARR",
          items: [],
          totalCount: 0,
          message: "No active Sonarr connection found",
        }
      }

      let credentials: ConnectionCredentials
      try {
        credentials = decryptConnectionData<ConnectionCredentials>(
          connection.encryptedData,
          session.user.id
        )
      } catch {
        return {
          success: false,
          connected: true,
          provider: "SONARR",
          items: [],
          totalCount: 0,
          message: "Failed to decrypt Sonarr connection credentials",
        }
      }

      const hostUrl =
        credentials.hostUrl ||
        (connection.settings as any)?.hostUrl ||
        connection.profileUrl ||
        ""

      try {
        const adapter = getConnectionAdapter("SONARR") as any
        const [rawSeries, rawProfiles] = await Promise.all([
          adapter.getSeries(credentials).catch(() => null),
          adapter.getQualityProfiles?.(credentials).catch(() => null),
        ])

        const profileMap = new Map<number, string>()
        if (Array.isArray(rawProfiles)) {
          rawProfiles.forEach((p: any) => {
            if (p?.id && p?.name) profileMap.set(p.id, p.name)
          })
        }

        if (Array.isArray(rawSeries)) {
          const mapped = rawSeries.map((s: any) => {
            const poster =
              s.images?.find((img: any) => img.coverType === "poster")
                ?.remoteUrl ||
              s.images?.find((img: any) => img.coverType === "poster")?.url ||
              null
            const fanart =
              s.images?.find((img: any) => img.coverType === "fanart")
                ?.remoteUrl ||
              s.images?.find((img: any) => img.coverType === "fanart")?.url ||
              null

            const qualityName =
              (s.qualityProfileId
                ? profileMap.get(s.qualityProfileId)
                : null) || "Any"

            const epCount =
              s.statistics?.episodeCount ?? s.statistics?.totalEpisodeCount
            const epFileCount = s.statistics?.episodeFileCount ?? 0
            const hasAllFiles = epCount > 0 && epFileCount >= epCount

            return {
              id: s.id || s.tvdbId || s.title,
              title: s.title || "Unknown Series",
              originalTitle: s.originalTitle || null,
              year: s.year || null,
              overview: s.overview || null,
              monitored: Boolean(s.monitored),
              hasFile: hasAllFiles,
              qualityProfile: qualityName,
              qualityProfileId: s.qualityProfileId || null,
              sizeOnDisk: s.statistics?.sizeOnDisk || null,
              status: hasAllFiles
                ? "Downloaded"
                : s.monitored
                  ? "Wanted"
                  : "Unmonitored",
              added: s.added || null,
              posterUrl: poster,
              fanartUrl: fanart,
              tvdbId: s.tvdbId || null,
              imdbId: s.imdbId || null,
              path: s.path || null,
              genres: s.genres || null,
              episodeCount: epCount || null,
              episodeFileCount: epFileCount || null,
              seasonCount: s.statistics?.seasonCount || null,
            }
          })

          return {
            success: true,
            connected: true,
            provider: "SONARR",
            hostUrl,
            items: mapped,
            totalCount: mapped.length,
          }
        }
      } catch (err) {
        console.warn("[Servarr] Failed to fetch live Sonarr series:", err)
      }

      // Fallback to local database TV lists
      const localList = await prisma.tvList.findMany({
        where: { userId: session.user.id },
        include: { tv: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      })

      const fallbackItems = localList.map((entry: any) => ({
        id: entry.tv.id,
        title: entry.tv.titlePrimary,
        originalTitle: entry.tv.titleSecondary || null,
        year: entry.tv.releaseDateYear || null,
        overview: entry.tv.description || null,
        monitored: true,
        hasFile: entry.status === "COMPLETED",
        qualityProfile: "Any",
        qualityProfileId: 1,
        sizeOnDisk: null,
        status: entry.status === "COMPLETED" ? "Downloaded" : "Wanted",
        added: entry.createdAt.toISOString(),
        posterUrl: entry.tv.coverImageMedium || null,
        fanartUrl: entry.tv.bannerImage || null,
        tvdbId: entry.tv.id,
        imdbId: entry.tv.imdbId || null,
        path: null,
        genres: entry.tv.genres || null,
      }))

      return {
        success: true,
        connected: true,
        provider: "SONARR",
        hostUrl,
        isLocalFallback: true,
        items: fallbackItems,
        totalCount: fallbackItems.length,
      }
    },
  },
})
