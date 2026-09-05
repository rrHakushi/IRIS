import { defineRoute, t } from "../../../../router"
import {
  SearchProxyManager,
  type ConnectionProvider,
  type MediaType,
} from "@IRIS/connections"
import { LastFmProvider } from "@/services/media-queue/providers/lastfm.provider"

export default defineRoute({
  GET: {
    schema: {
      query: t.Object({
        provider: t.String(),
        q: t.Optional(t.String()),
        id: t.Optional(t.String()),
        type: t.Optional(t.String()),
        page: t.Optional(t.Number()),
        perPage: t.Optional(t.Number()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          provider: t.String(),
          results: t.Array(
            t.Object({
              id: t.Optional(t.String()),
              externalId: t.String(),
              provider: t.String(),
              mediaType: t.String(),
              title: t.Object({
                userPreferred: t.String(),
                romaji: t.Optional(t.String()),
                english: t.Optional(t.String()),
                native: t.Optional(t.String()),
              }),
              description: t.Optional(t.String()),
              coverImage: t.Optional(
                t.Object({
                  extraLarge: t.Optional(t.String()),
                  large: t.Optional(t.String()),
                  medium: t.Optional(t.String()),
                  color: t.Optional(t.String()),
                })
              ),
              bannerImage: t.Optional(t.String()),
              format: t.Optional(t.String()),
              status: t.Optional(t.String()),
              episodes: t.Optional(t.Nullable(t.Number())),
              chapters: t.Optional(t.Nullable(t.Number())),
              volumes: t.Optional(t.Nullable(t.Number())),
              durationMinutes: t.Optional(t.Nullable(t.Number())),
              averageScore: t.Optional(t.Nullable(t.Number())),
              popularity: t.Optional(t.Nullable(t.Number())),
              releaseYear: t.Optional(t.Nullable(t.Number())),
              genres: t.Optional(t.Array(t.String())),
              url: t.Optional(t.String()),
            })
          ),
        }),
      },
    },
    async handler({ query, session, prisma }) {
      const provider = query.provider.toUpperCase() as ConnectionProvider

      // Handle Last.fm connection search natively
      if (provider === ("LASTFM" as any)) {
        const lastFm = new LastFmProvider()
        const searchQuery = (query.q || query.id || "").trim()

        if (!searchQuery) {
          return {
            success: true,
            provider: "LASTFM",
            results: [],
          }
        }

        try {
          const rawType = query.type?.toUpperCase()
          let tracks: any[] = []
          let albums: any[] = []

          // If query.id is a URL or direct identifier
          if (query.id) {
            let matchedTrack: any = null
            let matchedAlbum: any = null

            const trackMatch = query.id.match(/\/music\/([^/]+)\/_\/([^/?#]+)/i)
            const albumMatch = query.id.match(/\/music\/([^/]+)\/([^/?#]+)/i)

            if (trackMatch) {
              const artist = decodeURIComponent(trackMatch[1])
              const trackTitle = decodeURIComponent(trackMatch[2])
              matchedTrack = await lastFm.fetchTrack(artist, trackTitle)
            } else if (albumMatch && albumMatch[2] !== "_") {
              const artist = decodeURIComponent(albumMatch[1])
              const albumTitle = decodeURIComponent(albumMatch[2])
              matchedAlbum = await lastFm.fetchAlbum(artist, albumTitle)
            }

            if (matchedTrack) {
              const cover = lastFm.extractBestImage(matchedTrack.album?.image)
              return {
                success: true,
                provider: "LASTFM",
                results: [
                  {
                    id: matchedTrack.mbid || matchedTrack.url || query.id,
                    externalId: matchedTrack.url || query.id,
                    provider: "LASTFM",
                    mediaType: "MUSIC_TRACK",
                    format: "TRACK",
                    title: {
                      userPreferred: `${matchedTrack.name} - ${matchedTrack.artist?.name || ""}`.trim(),
                      english: matchedTrack.name,
                    },
                    coverImage: cover ? { large: cover, medium: cover } : undefined,
                    popularity: matchedTrack.listeners ? Number(matchedTrack.listeners) : undefined,
                    url: matchedTrack.url || query.id,
                  },
                ],
              }
            }

            if (matchedAlbum) {
              const cover = lastFm.extractBestImage(matchedAlbum.image)
              return {
                success: true,
                provider: "LASTFM",
                results: [
                  {
                    id: matchedAlbum.mbid || matchedAlbum.url || query.id,
                    externalId: matchedAlbum.url || query.id,
                    provider: "LASTFM",
                    mediaType: "MUSIC_ALBUM",
                    format: "ALBUM",
                    title: {
                      userPreferred: `${matchedAlbum.name} - ${matchedAlbum.artist}`.trim(),
                      english: matchedAlbum.name,
                    },
                    coverImage: cover ? { large: cover, medium: cover } : undefined,
                    popularity: matchedAlbum.listeners ? Number(matchedAlbum.listeners) : undefined,
                    url: matchedAlbum.url || query.id,
                  },
                ],
              }
            }
          }

          if (rawType === "ALBUM" || rawType === "MUSIC_ALBUM") {
            albums = await lastFm.searchAlbums(searchQuery, query.perPage || 15)
          } else if (rawType === "TRACK" || rawType === "MUSIC_TRACK") {
            tracks = await lastFm.searchTracks(searchQuery, undefined, query.perPage || 15)
          } else {
            const [tRes, aRes] = await Promise.all([
              lastFm.searchTracks(searchQuery, undefined, 10),
              lastFm.searchAlbums(searchQuery, 10),
            ])
            tracks = tRes
            albums = aRes
          }

          const results = [
            ...tracks.map((t) => {
              const cover = lastFm.extractBestImage(t.image)
              return {
                id: t.mbid || t.url,
                externalId: t.url || t.mbid || `${t.artist} - ${t.name}`,
                provider: "LASTFM",
                mediaType: "MUSIC_TRACK",
                format: "TRACK",
                title: {
                  userPreferred: `${t.name} - ${t.artist}`,
                  english: t.name,
                },
                coverImage: cover ? { large: cover, medium: cover } : undefined,
                popularity: t.listeners ? Number(t.listeners) : undefined,
                url: t.url,
              }
            }),
            ...albums.map((a) => {
              const cover = lastFm.extractBestImage(a.image)
              return {
                id: a.mbid || a.url,
                externalId: a.url || a.mbid || `${a.artist} - ${a.name}`,
                provider: "LASTFM",
                mediaType: "MUSIC_ALBUM",
                format: "ALBUM",
                title: {
                  userPreferred: `${a.name} - ${a.artist}`,
                  english: a.name,
                },
                coverImage: cover ? { large: cover, medium: cover } : undefined,
                popularity: a.listeners ? Number(a.listeners) : undefined,
                url: a.url,
              }
            }),
          ]

          return {
            success: true,
            provider: "LASTFM",
            results,
          }
        } catch {
          return {
            success: true,
            provider: "LASTFM",
            results: [],
          }
        }
      }

      let userConnection: any = null

      if (session.isAuthenticated && session.user) {
        userConnection = await prisma.connection.findFirst({
          where: {
            userId: session.user.id,
            provider: provider as any,
            status: "CONNECTED",
          },
        })
      }

      if (query.id) {
        try {
          const direct = await SearchProxyManager.getById(
            provider,
            query.id,
            userConnection,
            {
              type: query.type?.toUpperCase() as MediaType,
            }
          )
          if (direct) {
            const hasValidExt =
              Boolean(direct.externalId) &&
              direct.externalId !== "undefined" &&
              direct.externalId !== "null"
            const hasValidId =
              Boolean(direct.id) &&
              direct.id !== "undefined" &&
              direct.id !== "null"
            const finalId = hasValidExt
              ? direct.externalId
              : hasValidId
                ? direct.id
                : query.id

            return {
              success: true,
              provider,
              results: [
                {
                  ...direct,
                  id: hasValidId ? direct.id : finalId,
                  externalId: finalId,
                  url:
                    direct.url && !direct.url.endsWith("/undefined")
                      ? direct.url
                      : `https://simkl.com/anime/${finalId}`,
                },
              ],
            }
          }
        } catch {
          // Fall back to search
        }
      }

      const searchQuery = query.q || query.id || ""
      if (!searchQuery.trim()) {
        return {
          success: true,
          provider,
          results: [],
        }
      }

      const results = await SearchProxyManager.search(
        provider,
        searchQuery,
        userConnection,
        {
          type: query.type?.toUpperCase() as MediaType,
          page: query.page,
          perPage: query.perPage,
        },
        async (connId, updatedEncrypted, expiresAt) => {
          await prisma.connection.update({
            where: { id: connId },
            data: {
              encryptedData: updatedEncrypted,
              expiresAt,
            },
          })
        }
      )

      const cleanedResults = (results || []).map((r: any, idx: number) => {
        const hasValidExt =
          Boolean(r.externalId) &&
          r.externalId !== "undefined" &&
          r.externalId !== "null"
        const hasValidId =
          Boolean(r.id) && r.id !== "undefined" && r.id !== "null"
        const finalId = hasValidExt
          ? r.externalId
          : hasValidId
            ? r.id
            : String(idx)

        return {
          ...r,
          id: hasValidId ? r.id : finalId,
          externalId: finalId,
          url:
            r.url && !r.url.endsWith("/undefined")
              ? r.url
              : `https://simkl.com/anime/${finalId}`,
        }
      })

      return {
        success: true,
        provider,
        results: cleanedResults,
      }
    },
  },
})
