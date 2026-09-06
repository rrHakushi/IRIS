import { prisma } from "@IRIS/database"
import { mediaDbSyncer } from "../media-queue/media-db.syncer.js"
import { LrcLibProvider } from "../media-queue/providers/lrclib.provider.js"
import { DeezerProvider, type DeezerPlaylistPayload, type DeezerTrackPayload } from "../media-queue/providers/deezer.provider.js"
import { logger } from "../../utils/logger.js"

export interface DeezerImportResult {
  success: boolean
  playlistsImported: number
  tracksImported: number
  customLists: Array<{ id: string; name: string; trackCount: number }>
  error?: string
}

export class DeezerPlaylistService {
  private deezer = new DeezerProvider()
  private lrclib = new LrcLibProvider()

  /**
   * Imports all playlists from a connected Deezer user account:
   * 1. Fetches playlists from Deezer API.
   * 2. Finds or creates a CustomList for each playlist.
   * 3. Fetches playlist tracks, saves artists to Person, lyrics from LRCLIB if available,
   *    and saves songs to the Music table.
   * 4. Adds songs to user's MusicList.
   * 5. Adds songs into CustomListEntry for that CustomList.
   */
  async importUserPlaylists(
    userId: string,
    accessToken: string
  ): Promise<DeezerImportResult> {
    if (!accessToken) {
      return {
        success: false,
        playlistsImported: 0,
        tracksImported: 0,
        customLists: [],
        error: "Missing Deezer access token",
      }
    }

    try {
      const url = `https://api.deezer.com/user/me/playlists?access_token=${encodeURIComponent(
        accessToken
      )}&limit=50`

      const res = await fetch(url, {
        headers: {
          "User-Agent": "IRIS-Platform/1.0 (https://iris.app)",
          Accept: "application/json",
        },
      })

      if (!res.ok) {
        return {
          success: false,
          playlistsImported: 0,
          tracksImported: 0,
          customLists: [],
          error: `Deezer API error: HTTP ${res.status}`,
        }
      }

      const json = (await res.json()) as {
        data?: Array<{
          id: number
          title: string
          description?: string
          nb_tracks: number
          picture?: string
          picture_medium?: string
          picture_big?: string
        }>
        error?: {
          message?: string
          type?: string
          code?: number
        }
      }

      if (json.error) {
        return {
          success: false,
          playlistsImported: 0,
          tracksImported: 0,
          customLists: [],
          error: json.error.message || "Deezer API returned an error",
        }
      }

      const playlists = json.data || []
      let totalTracksImported = 0
      const importedCustomLists: Array<{ id: string; name: string; trackCount: number }> = []

      for (const pl of playlists) {
        if (!pl.title) continue

        // 1. Find or create CustomList
        let customList = await prisma.customList.findFirst({
          where: { userId, name: pl.title },
        })

        const coverImage = pl.picture_big || pl.picture_medium || pl.picture

        if (!customList) {
          customList = await prisma.customList.create({
            data: {
              userId,
              name: pl.title,
              description: pl.description || `Imported from Deezer playlist (${pl.nb_tracks} tracks)`,
              coverImage,
            },
          })
        }

        // 2. Fetch full playlist details with tracks
        const fullPlaylist = await this.deezer.getPlaylist(pl.id)
        const tracks = fullPlaylist?.tracks?.data || []
        let plTrackCount = 0

        for (let idx = 0; idx < tracks.length; idx++) {
          const track = tracks[idx]
          if (!track?.title) continue

          try {
            // Save artist to Person
            if (track.artist) {
              await mediaDbSyncer.upsertDeezerArtist(track.artist).catch(() => {})
            }

            // Fallback to LRCLIB for lyrics
            let lyrics: import("../media-queue/providers/lrclib.provider.js").LrcLibLyricsPayload | null = null
            if (track.artist?.name && track.title) {
              lyrics = await this.lrclib.fetchLyrics(
                track.title,
                track.artist.name,
                track.album?.title,
                track.duration
              )
            }

            // Save song to Music table first
            const savedMusic = await mediaDbSyncer.upsertMusic(
              {
                type: "TRACK",
                deezerId: track.id,
                isrc: track.isrc,
                titlePrimary: track.title,
                titleSecondary: track.title_short,
                titleVersion: track.title_version,
                link: track.link,
                share: track.share,
                coverImage: track.album?.cover_big || track.album?.cover_medium || track.album?.cover,
                images: track.album
                  ? {
                      small: track.album.cover_small,
                      medium: track.album.cover_medium,
                      big: track.album.cover_big,
                      xl: track.album.cover_xl,
                    }
                  : undefined,
                duration: track.duration,
                trackPosition: track.track_position,
                diskNumber: track.disk_number,
                rank: track.rank,
                explicitLyrics: track.explicit_lyrics,
                explicitContentLyrics: track.explicit_content_lyrics,
                explicitContentCover: track.explicit_content_cover,
                audioPreviewUrl: track.preview,
                bpm: track.bpm,
                gain: track.gain,
                albumTitle: track.album?.title,
                artist: track.artist,
              },
              lyrics
            )

            // Add song to user's MusicList
            await prisma.musicList.upsert({
              where: {
                userId_musicId: {
                  userId,
                  musicId: savedMusic.id,
                },
              },
              update: {
                status: "COMPLETED",
              },
              create: {
                userId,
                musicId: savedMusic.id,
                status: "COMPLETED",
                playCount: 1,
              },
            })

            // Put song into CustomListEntry
            await prisma.customListEntry.upsert({
              where: {
                listId_mediaType_mediaId: {
                  listId: customList.id,
                  mediaType: "MUSIC",
                  mediaId: savedMusic.id,
                },
              },
              update: {
                order: idx,
                musicId: savedMusic.id,
              },
              create: {
                listId: customList.id,
                mediaType: "MUSIC",
                mediaId: savedMusic.id,
                musicId: savedMusic.id,
                order: idx,
              },
            })

            plTrackCount++
            totalTracksImported++
          } catch (trackErr) {
            const msg = trackErr instanceof Error ? trackErr.message : String(trackErr)
            logger.warn(
              `[DeezerPlaylist] Failed importing track "${track.title}" for list "${pl.title}": ${msg}`
            )
          }
        }

        importedCustomLists.push({
          id: customList.id,
          name: customList.name,
          trackCount: plTrackCount,
        })
      }

      return {
        success: true,
        playlistsImported: playlists.length,
        tracksImported: totalTracksImported,
        customLists: importedCustomLists,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to import Deezer playlists"
      return {
        success: false,
        playlistsImported: 0,
        tracksImported: 0,
        customLists: [],
        error: msg,
      }
    }
  }

  /**
   * Imports a specific Deezer playlist by its ID:
   * 1. Fetches full playlist from Deezer.
   * 2. Creates or finds a CustomList.
   * 3. Saves all tracks to the Music table, artists to Person, lyrics from LRCLIB.
   * 4. Adds tracks to the user's MusicList and creates CustomListEntry records.
   */
  async importPlaylistById(
    userId: string,
    playlistId: string | number
  ): Promise<{
    success: boolean
    customList?: { id: string; name: string; trackCount: number }
    tracksImported: number
    error?: string
  }> {
    try {
      const fullPlaylist = await this.deezer.getPlaylist(playlistId)
      if (!fullPlaylist || !fullPlaylist.title) {
        return {
          success: false,
          tracksImported: 0,
          error: `Could not fetch Deezer playlist ${playlistId}`,
        }
      }

      const coverImage =
        fullPlaylist.picture_big ||
        fullPlaylist.picture_medium ||
        fullPlaylist.picture ||
        null

      let customList = await prisma.customList.findFirst({
        where: { userId, name: fullPlaylist.title },
      })

      if (!customList) {
        customList = await prisma.customList.create({
          data: {
            userId,
            name: fullPlaylist.title,
            description:
              fullPlaylist.description ||
              `Imported from Deezer playlist (${fullPlaylist.nb_tracks || 0} tracks)`,
            coverImage,
          },
        })
      }

      const tracks = fullPlaylist.tracks?.data || []
      let tracksImported = 0

      for (let idx = 0; idx < tracks.length; idx++) {
        const track = tracks[idx]
        if (!track?.title) continue

        try {
          if (track.artist) {
            await mediaDbSyncer.upsertDeezerArtist(track.artist).catch(() => {})
          }

          let lyrics: import("../media-queue/providers/lrclib.provider.js").LrcLibLyricsPayload | null = null
          if (track.artist?.name && track.title) {
            lyrics = await this.lrclib.fetchLyrics(
              track.title,
              track.artist.name,
              track.album?.title,
              track.duration
            )
          }

          const savedMusic = await mediaDbSyncer.upsertMusic(
            {
              type: "TRACK",
              deezerId: track.id,
              isrc: track.isrc,
              titlePrimary: track.title,
              titleSecondary: track.title_short,
              titleVersion: track.title_version,
              link: track.link,
              share: track.share,
              coverImage:
                track.album?.cover_big ||
                track.album?.cover_medium ||
                track.album?.cover,
              images: track.album
                ? {
                    small: track.album.cover_small,
                    medium: track.album.cover_medium,
                    big: track.album.cover_big,
                    xl: track.album.cover_xl,
                  }
                : undefined,
              duration: track.duration,
              trackPosition: track.track_position,
              diskNumber: track.disk_number,
              rank: track.rank,
              explicitLyrics: track.explicit_lyrics,
              explicitContentLyrics: track.explicit_content_lyrics,
              explicitContentCover: track.explicit_content_cover,
              audioPreviewUrl: track.preview,
              bpm: track.bpm,
              gain: track.gain,
              albumTitle: track.album?.title,
              artist: track.artist,
            },
            lyrics
          )

          await prisma.musicList.upsert({
            where: {
              userId_musicId: {
                userId,
                musicId: savedMusic.id,
              },
            },
            update: {
              status: "COMPLETED",
            },
            create: {
              userId,
              musicId: savedMusic.id,
              status: "COMPLETED",
              playCount: 1,
            },
          })

          await prisma.customListEntry.upsert({
            where: {
              listId_mediaType_mediaId: {
                listId: customList.id,
                mediaType: "MUSIC",
                mediaId: savedMusic.id,
              },
            },
            update: {
              order: idx,
              musicId: savedMusic.id,
            },
            create: {
              listId: customList.id,
              mediaType: "MUSIC",
              mediaId: savedMusic.id,
              musicId: savedMusic.id,
              order: idx,
            },
          })

          tracksImported++
        } catch (trackErr) {
          const msg = trackErr instanceof Error ? trackErr.message : String(trackErr)
          logger.warn(
            `[DeezerPlaylist] Failed importing track "${track.title}" for list "${fullPlaylist.title}": ${msg}`
          )
        }
      }

      return {
        success: true,
        customList: {
          id: customList.id,
          name: customList.name,
          trackCount: tracksImported,
        },
        tracksImported,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to import Deezer playlist"
      return {
        success: false,
        tracksImported: 0,
        error: msg,
      }
    }
  }
}

export const deezerPlaylistService = new DeezerPlaylistService()
