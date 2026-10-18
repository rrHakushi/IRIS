import { defineRoute, t } from "@/router"
import {
  getConnectionAdapter,
  decryptConnectionData,
  type ConnectionCredentials,
} from "@IRIS/connections"

export const ServarrMediaItemSchema = t.Object({
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
  tmdbId: t.Optional(t.Nullable(t.Number())),
  imdbId: t.Optional(t.Nullable(t.String())),
  path: t.Optional(t.Nullable(t.String())),
  genres: t.Optional(t.Nullable(t.Array(t.String()))),
})

export const ServarrLibraryResponseSchema = t.Object({
  success: t.Boolean(),
  connected: t.Boolean(),
  provider: t.String(),
  hostUrl: t.Optional(t.Nullable(t.String())),
  isLocalFallback: t.Optional(t.Boolean()),
  items: t.Array(ServarrMediaItemSchema),
  totalCount: t.Number(),
  message: t.Optional(t.String()),
})

export default defineRoute({
  GET: {
    schema: {
      response: {
        200: ServarrLibraryResponseSchema,
      },
      detail: {
        summary: "Get Radarr added movies library",
        description:
          "Fetches all added movies directly from the connected Radarr instance with local database fallback.",
        tags: ["Servarr", "Radarr"],
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
          provider: "RADARR",
          status: "CONNECTED",
        },
      })

      if (!connection) {
        return {
          success: true,
          connected: false,
          provider: "RADARR",
          items: [],
          totalCount: 0,
          message: "No active Radarr connection found",
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
          provider: "RADARR",
          items: [],
          totalCount: 0,
          message: "Failed to decrypt Radarr connection credentials",
        }
      }

      const hostUrl =
        credentials.hostUrl ||
        (connection.settings as any)?.hostUrl ||
        connection.profileUrl ||
        ""

      try {
        const adapter = getConnectionAdapter("RADARR") as any
        const [rawMovies, rawProfiles] = await Promise.all([
          adapter.getMovies(credentials).catch(() => null),
          adapter.getQualityProfiles?.(credentials).catch(() => null),
        ])

        const profileMap = new Map<number, string>()
        if (Array.isArray(rawProfiles)) {
          rawProfiles.forEach((p: any) => {
            if (p?.id && p?.name) profileMap.set(p.id, p.name)
          })
        }

        if (Array.isArray(rawMovies)) {
          const mapped = rawMovies.map((m: any) => {
            const poster =
              m.images?.find((img: any) => img.coverType === "poster")
                ?.remoteUrl ||
              m.images?.find((img: any) => img.coverType === "poster")?.url ||
              null
            const fanart =
              m.images?.find((img: any) => img.coverType === "fanart")
                ?.remoteUrl ||
              m.images?.find((img: any) => img.coverType === "fanart")?.url ||
              null

            const qualityName =
              (m.qualityProfileId
                ? profileMap.get(m.qualityProfileId)
                : null) ||
              m.qualityProfile?.name ||
              "Any"

            return {
              id: m.id || m.tmdbId || m.title,
              title: m.title || "Unknown Movie",
              originalTitle: m.originalTitle || null,
              year: m.year || null,
              overview: m.overview || null,
              monitored: Boolean(m.monitored),
              hasFile: Boolean(m.hasFile),
              qualityProfile: qualityName,
              qualityProfileId: m.qualityProfileId || null,
              sizeOnDisk: m.sizeOnDisk || m.statistics?.sizeOnDisk || null,
              status: m.hasFile
                ? "Downloaded"
                : m.monitored
                  ? "Wanted"
                  : "Unmonitored",
              added: m.added || null,
              posterUrl: poster,
              fanartUrl: fanart,
              tmdbId: m.tmdbId || null,
              imdbId: m.imdbId || null,
              path: m.path || null,
              genres: m.genres || null,
            }
          })

          return {
            success: true,
            connected: true,
            provider: "RADARR",
            hostUrl,
            items: mapped,
            totalCount: mapped.length,
          }
        }
      } catch (err) {
        console.warn("[Servarr] Failed to fetch live Radarr movies:", err)
      }

      // Fallback to local database movie lists
      const localList = await prisma.movieList.findMany({
        where: { userId: session.user.id },
        include: { movie: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      })

      const fallbackItems = localList.map((entry: any) => ({
        id: entry.movie.id,
        title: entry.movie.titlePrimary,
        originalTitle: entry.movie.titleSecondary || null,
        year: entry.movie.releaseDateYear || null,
        overview: entry.movie.description || null,
        monitored: true,
        hasFile: entry.status === "COMPLETED",
        qualityProfile: "Any",
        qualityProfileId: 1,
        sizeOnDisk: null,
        status: entry.status === "COMPLETED" ? "Downloaded" : "Wanted",
        added: entry.createdAt.toISOString(),
        posterUrl: entry.movie.coverImageMedium || null,
        fanartUrl: entry.movie.bannerImage || null,
        tmdbId: entry.movie.id,
        imdbId: entry.movie.imdbId || null,
        path: null,
        genres: entry.movie.genres || null,
      }))

      return {
        success: true,
        connected: true,
        provider: "RADARR",
        hostUrl,
        isLocalFallback: true,
        items: fallbackItems,
        totalCount: fallbackItems.length,
      }
    },
  },
})
