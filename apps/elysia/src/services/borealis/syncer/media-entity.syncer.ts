import { prisma, normalizeMediaStatus, type RelationType } from '@IRIS/database'
import { LogFactory, c } from '@Iris/logger'
import {
  anilistProvider,
  type AniListAnimePayload,
  type AniListMangaPayload,
  tvdbProvider,
  igdbProvider,
  googleBooksProvider,
  deezerProvider,
} from '../providers'
import {
  MediaPreviewSyncer,
  mapAnimeFormat,
  mapMangaFormat,
  type PreviewResult,
} from './media-preview.syncer'
import { MediaQueueManager, type MediaType } from '../queue'

const logger = new LogFactory('Borealis:EntitySyncer')

export interface DiscoveredRelation {
  sourceType: MediaType
  sourceId: number
  sourceExternalId?: number | string | null
  targetType: MediaType
  targetExternalId: number | string
  targetLocalId: number
  type: string
}

export interface EntitySyncResult {
  synced: boolean
  discoveredRelations: DiscoveredRelation[]
}

export function mapRelationType(rawType: string): RelationType {
  const norm = rawType.toUpperCase().replace(/\s+/g, '_')
  switch (norm) {
    case 'PREQUEL':
      return 'PREQUEL'
    case 'SEQUEL':
      return 'SEQUEL'
    case 'ADAPTATION':
      return 'ADAPTATION'
    case 'SIDE_STORY':
      return 'SIDE_STORY'
    case 'SPIN_OFF':
      return 'SPIN_OFF'
    case 'SUMMARY':
      return 'SUMMARY'
    case 'ALTERNATIVE':
      return 'ALTERNATIVE'
    case 'CHARACTER':
      return 'CHARACTER'
    case 'PARENT':
    case 'SOURCE':
    case 'COMPILATION':
    case 'CONTAINS':
    case 'OTHER':
      return 'OTHER'
    default:
      return 'UNKNOWN'
  }
}

export class MediaEntitySyncer {
  private static async upsertGenres(genreNames?: string[]): Promise<Array<{ id: number }>> {
    if (!genreNames || genreNames.length === 0) return []
    const results: Array<{ id: number }> = []
    for (const name of genreNames) {
      const clean = name.trim()
      if (!clean) continue
      const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'genre'
      try {
        let genre = await prisma.orm.public.Genre.where({ name: clean }).select('id').first()
        if (!genre) {
          genre = await prisma.orm.public.Genre.create({ name: clean, slug })
        }
        results.push({ id: genre.id })
      } catch {}
    }
    return results
  }

  private static async handleMusicRelation(
    sourceType: MediaType,
    sourceId: number,
    edge: any
  ): Promise<void> {
    const rawTitle =
      edge.node?.title?.userPreferred ||
      edge.node?.title?.english ||
      edge.node?.title?.romaji ||
      ''
    const musicTitle = rawTitle.trim()
    if (!musicTitle) return

    try {
      logger.info(
        `${c.cyan('🎵 [Music Relation]')}: Discovered music relation "${c.yellow(musicTitle)}" for ${sourceType} #${sourceId}; querying Deezer...`
      )

      const tracks = await deezerProvider.searchTracks(musicTitle, 3).catch(() => [])
      let musicStub: PreviewResult | null = null

      if (tracks && tracks.length > 0 && tracks[0]) {
        musicStub = await MediaPreviewSyncer.upsertMusicTrackSearchPreview(tracks[0])
      } else {
        const albums = await deezerProvider.searchAlbums(musicTitle, 3).catch(() => [])
        if (albums && albums.length > 0 && albums[0]) {
          musicStub = await MediaPreviewSyncer.upsertMusicAlbumSearchPreview(albums[0])
        }
      }

      if (musicStub) {
        const existingRel = await prisma.orm.public.MediaRelation.where({
          sourceType,
          sourceId,
          targetType: 'MUSIC' as MediaType,
          targetId: musicStub.id,
          type: 'OTHER' as RelationType,
        }).first()
        if (!existingRel) {
          await prisma.orm.public.MediaRelation.create({
            sourceType,
            sourceId,
            targetType: 'MUSIC' as MediaType,
            targetId: musicStub.id,
            type: 'OTHER' as RelationType,
          }).catch(() => {})
        }

        await MediaQueueManager.enqueueMediaUpdate('MUSIC', musicStub.id, {
          externalId: musicStub.externalId,
          priority: 3,
          depth: 0,
          maxDepth: 0,
          jobId: `media-update-MUSIC-${musicStub.id}`,
        }).catch(() => {})

        logger.info(
          `${c.green('✅ [Music Relation Synced]')}: Linked Deezer Music #${musicStub.id} ("${musicStub.titlePrimary}") to ${sourceType} #${sourceId}`
        )
      } else {
        logger.info(
          `${c.dim('⏩ [Music Relation Skipped]')}: No matching Deezer track/album found for "${musicTitle}"`
        )
      }
    } catch (err: any) {
      logger.warn(
        `${c.red('⚠️ [Music Relation Error]')}: Failed to resolve music relation "${musicTitle}": ${err?.message || err}`
      )
    }
  }

  private static async syncMediaCharacters(
    mediaType: 'ANIME' | 'MANGA',
    mediaId: number,
    characters?: AniListAnimePayload['characters']
  ): Promise<void> {
    if (!characters?.edges || !Array.isArray(characters.edges)) return

    for (const edge of characters.edges) {
      if (!edge?.node?.name?.full) continue
      const anilistCharId = edge.node.id
      const charImage = edge.node.image?.medium || edge.node.image?.large || null

      try {
        let char = await prisma.orm.public.Character.where({ anilistId: anilistCharId })
          .select('id', 'image')
          .first()

        if (!char) {
          char = await prisma.orm.public.Character.create({
            anilistId: anilistCharId,
            namePrimary: edge.node.name.full,
            nameNative: edge.node.name.native || null,
            nameAlternative: edge.node.name.alternative || [],
            nameAlternativeSpoiler: edge.node.name.alternativeSpoiler || [],
            image: charImage,
            description: edge.node.description || null,
            gender: edge.node.gender || null,
            age: edge.node.age || null,
            favorites: edge.node.favourites || 0,
          })
        } else if (!char.image && charImage) {
          await prisma.orm.public.Character.where({ id: char.id }).update({
            image: charImage,
          }).catch(() => {})
        }

        const role =
          edge.role === 'MAIN'
            ? 'MAIN'
            : edge.role === 'SUPPORTING'
              ? 'SUPPORTING'
              : 'BACKGROUND'

        const voiceActors = (edge as any).voiceActors
        if (voiceActors && Array.isArray(voiceActors) && voiceActors.length > 0) {
          for (const va of voiceActors) {
            if (!va?.name?.full) continue
            const vaImage = va.image?.medium || va.image?.large || null
            let person = await prisma.orm.public.Person.where({ anilistId: va.id })
              .select('id', 'image')
              .first()
            if (!person) {
              person = await prisma.orm.public.Person.create({
                anilistId: va.id,
                namePrimary: va.name.full,
                nameNative: va.name.native || null,
                nameAlternative: [],
                image: vaImage,
                language: va.languageV2 || null,
                primaryOccupations: [],
                yearsActive: [],
              })
            } else if (!person.image && vaImage) {
              await prisma.orm.public.Person.where({ id: person.id }).update({
                image: vaImage,
              }).catch(() => {})
            }

            const existingMC = await prisma.orm.public.MediaCharacter.where({
              mediaType,
              mediaId,
              characterId: char.id,
              actorId: person.id,
            }).first()

            if (existingMC) {
              await prisma.orm.public.MediaCharacter.where({ id: existingMC.id }).update({
                role,
                animeId: mediaType === 'ANIME' ? mediaId : null,
                mangaId: mediaType === 'MANGA' ? mediaId : null,
              }).catch(() => {})
            } else {
              await prisma.orm.public.MediaCharacter.create({
                mediaType,
                mediaId,
                characterId: char.id,
                actorId: person.id,
                role,
                animeId: mediaType === 'ANIME' ? mediaId : null,
                mangaId: mediaType === 'MANGA' ? mediaId : null,
              }).catch(() => {})
            }
          }
        } else {
          const existingMC = await prisma.orm.public.MediaCharacter.where({
            mediaType,
            mediaId,
            characterId: char.id,
            actorId: null,
          }).first()

          if (existingMC) {
            await prisma.orm.public.MediaCharacter.where({ id: existingMC.id }).update({
              role,
              animeId: mediaType === 'ANIME' ? mediaId : null,
              mangaId: mediaType === 'MANGA' ? mediaId : null,
            }).catch(() => {})
          } else {
            await prisma.orm.public.MediaCharacter.create({
              mediaType,
              mediaId,
              characterId: char.id,
              actorId: null,
              role,
              animeId: mediaType === 'ANIME' ? mediaId : null,
              mangaId: mediaType === 'MANGA' ? mediaId : null,
            }).catch(() => {})
          }
        }
      } catch (err: any) {
        logger.warn(`Failed to sync character for ${mediaType} #${mediaId}: ${err?.message || err}`)
      }
    }
  }

  private static async syncMediaStaff(
    mediaType: 'ANIME' | 'MANGA',
    mediaId: number,
    staff?: AniListAnimePayload['staff']
  ): Promise<void> {
    if (!staff?.edges || !Array.isArray(staff.edges)) return

    for (const edge of staff.edges) {
      if (!edge?.node?.name?.full) continue
      const anilistPersonId = edge.node.id
      const staffImage = edge.node.image?.medium || edge.node.image?.large || null

      try {
        let person = await prisma.orm.public.Person.where({ anilistId: anilistPersonId })
          .select('id', 'image')
          .first()

        if (!person) {
          person = await prisma.orm.public.Person.create({
            anilistId: anilistPersonId,
            namePrimary: edge.node.name.full,
            nameNative: edge.node.name.native || null,
            nameAlternative: edge.node.name.alternative || [],
            image: staffImage,
            description: edge.node.description || null,
            primaryOccupations: edge.node.primaryOccupations || [],
            yearsActive: [],
          })
        } else if (!person.image && staffImage) {
          await prisma.orm.public.Person.where({ id: person.id }).update({
            image: staffImage,
          }).catch(() => {})
        }

        const existingStaff = await prisma.orm.public.MediaStaff.where({
          mediaType,
          mediaId,
          personId: person.id,
          role: 'OTHER',
        }).first()

        if (existingStaff) {
          await prisma.orm.public.MediaStaff.where({ id: existingStaff.id }).update({
            customRole: edge.role,
            animeId: mediaType === 'ANIME' ? mediaId : null,
            mangaId: mediaType === 'MANGA' ? mediaId : null,
          }).catch(() => {})
        } else {
          await prisma.orm.public.MediaStaff.create({
            mediaType,
            mediaId,
            personId: person.id,
            role: 'OTHER',
            customRole: edge.role,
            animeId: mediaType === 'ANIME' ? mediaId : null,
            mangaId: mediaType === 'MANGA' ? mediaId : null,
          }).catch(() => {})
        }
      } catch (err: any) {
        logger.warn(`Failed to sync staff member for ${mediaType} #${mediaId}: ${err?.message || err}`)
      }
    }
  }

  /**
   * Fully synchronizes an Anime entity from AniList, discovers connected relations,
   * creates local preview stubs, and establishes MediaRelation edges.
   */
  static async syncAnime(animeId: number, externalId?: number | string | null): Promise<EntitySyncResult> {
    try {
      let anilistId: number | null = externalId ? Number(externalId) : null
      if (!anilistId) {
        const record = await prisma.orm.public.Anime.where({ id: animeId })
          .select('anilistId')
          .first()
        anilistId = record?.anilistId ?? null
      }

      if (!anilistId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Anime #${animeId}: missing AniList ID`)
        return { synced: false, discoveredRelations: [] }
      }

      logger.info(
        `${c.magenta('📡 [1/2]')} Querying AniList GraphQL API for Anime #${anilistId} (Local #${animeId})...`
      )
      const alData = await anilistProvider.fetchAnime(anilistId)
      if (!alData) {
        logger.warn(
          `${c.yellow('⚠️ [AniList Empty]')}: No anime data returned for AniList #${anilistId}`
        )
        return { synced: false, discoveredRelations: [] }
      }

      const displayTitle = alData.title.userPreferred || alData.title.english || alData.title.romaji || 'Unknown'
      const genreRecords = await this.upsertGenres(alData.genres)
      logger.info(
        `${c.magenta('📥 [1/2]')} AniList received: "${c.bold(displayTitle)}" (episodes=${alData.episodes || 'N/A'}, duration=${alData.duration || 'N/A'}m, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Anime #${animeId} record to database...`)
      await prisma.orm.public.Anime.where({ id: animeId }).update({
        titlePrimary:
          alData.title.english ||
          alData.title.userPreferred ||
          alData.title.romaji ||
          undefined,
        titleSecondary: alData.title.romaji || alData.title.english || undefined,
        titleNative: alData.title.native || undefined,
        description: alData.description || undefined,
        coverImage: alData.coverImage?.medium || alData.coverImage?.large || undefined,
        bannerImage: alData.bannerImage || undefined,
        episodeCount: alData.episodes || undefined,
        alAverageScore: alData.averageScore || undefined,
        alPopularity: alData.popularity || undefined,
        alFavorites: alData.favourites || undefined,
        seasonYear: alData.seasonYear || undefined,
        seasonSeason: (alData.season as any) || undefined,
        format: (alData.format as any) || undefined,
        status: alData.status ? normalizeMediaStatus(alData.status) : undefined,
        alUpdatedAt: nowUnix,
        updatedAt: now,
      })

      if (genreRecords.length > 0) {
        try {
          await prisma.orm.public.AnimeGenre.where({ animeId }).deleteAll()
        } catch {}
        for (const g of genreRecords) {
          await prisma.orm.public.AnimeGenre.create({ animeId, genreId: g.id }).catch(() => {})
        }
      }

      // Sync Characters, Voice Actors, and Staff with medium image (fallback to large)
      await this.syncMediaCharacters('ANIME', animeId, alData.characters)
      await this.syncMediaStaff('ANIME', animeId, alData.staff)

      const discoveredRelations: DiscoveredRelation[] = []
      if (alData.relations?.edges && Array.isArray(alData.relations.edges)) {
        for (const edge of alData.relations.edges) {
          if (!edge?.node) continue

          const isMusic =
            edge.node.format === 'MUSIC' ||
            (edge.node.type as string) === 'MUSIC'

          if (isMusic) {
            await this.handleMusicRelation('ANIME', animeId, edge)
            continue
          }

          const rawRelType = edge.relationType
          if (!rawRelType) continue
          const relType = mapRelationType(rawRelType)
          if (relType === 'UNKNOWN') continue

          const targetType: MediaType = edge.node.type === 'MANGA' ? 'MANGA' : 'ANIME'
          const targetExternalId = edge.node.id
          if (!targetExternalId) continue

          let localTargetId: number
          if (targetType === 'ANIME') {
            let targetAnime = await prisma.orm.public.Anime.where({ anilistId: targetExternalId })
              .select('id')
              .first()
            if (!targetAnime) {
              const targetTitle =
                edge.node.title?.english ||
                edge.node.title?.userPreferred ||
                edge.node.title?.romaji ||
                `Anime #${targetExternalId}`
              targetAnime = await prisma.orm.public.Anime.create({
                anilistId: targetExternalId,
                titlePrimary: targetTitle,
                titleSecondary: edge.node.title?.romaji || edge.node.title?.english || null,
                titleNative: edge.node.title?.native || null,
                coverImage: edge.node.coverImage?.medium || edge.node.coverImage?.large || null,
                format: mapAnimeFormat(edge.node.format),
                synonyms: [],
              })
            }
            localTargetId = targetAnime.id
          } else {
            let targetManga = await prisma.orm.public.Manga.where({ anilistId: targetExternalId })
              .select('id')
              .first()
            if (!targetManga) {
              const targetTitle =
                edge.node.title?.english ||
                edge.node.title?.userPreferred ||
                edge.node.title?.romaji ||
                `Manga #${targetExternalId}`
              targetManga = await prisma.orm.public.Manga.create({
                anilistId: targetExternalId,
                titlePrimary: targetTitle,
                titleSecondary: edge.node.title?.romaji || edge.node.title?.english || null,
                titleNative: edge.node.title?.native || null,
                coverImage: edge.node.coverImage?.medium || edge.node.coverImage?.large || null,
                format: mapMangaFormat(edge.node.format),
                synonyms: [],
              })
            }
            localTargetId = targetManga.id
          }

          const existingRel = await prisma.orm.public.MediaRelation.where({
            sourceType: 'ANIME',
            sourceId: animeId,
            targetType,
            targetId: localTargetId,
            type: relType,
          }).first()

          if (!existingRel) {
            await prisma.orm.public.MediaRelation.create({
              sourceType: 'ANIME',
              sourceId: animeId,
              targetType,
              targetId: localTargetId,
              type: relType,
            }).catch(() => {})
          }

          discoveredRelations.push({
            sourceType: 'ANIME',
            sourceId: animeId,
            sourceExternalId: anilistId,
            targetType,
            targetExternalId,
            targetLocalId: localTargetId,
            type: relType,
          })
        }
      }

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Anime #${animeId} ("${displayTitle}") with ${discoveredRelations.length} relations`
      )
      return { synced: true, discoveredRelations }
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Anime #${animeId}: ${err?.message || err}`)
      return { synced: false, discoveredRelations: [] }
    }
  }

  /**
   * Fully synchronizes a Manga entity from AniList, discovers connected relations,
   * creates local preview stubs, and establishes MediaRelation edges.
   */
  static async syncManga(mangaId: number, externalId?: number | string | null): Promise<EntitySyncResult> {
    try {
      let anilistId: number | null = externalId ? Number(externalId) : null
      if (!anilistId) {
        const record = await prisma.orm.public.Manga.where({ id: mangaId })
          .select('anilistId')
          .first()
        anilistId = record?.anilistId ?? null
      }

      if (!anilistId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Manga #${mangaId}: missing AniList ID`)
        return { synced: false, discoveredRelations: [] }
      }

      logger.info(
        `${c.magenta('📡 [1/2]')} Querying AniList GraphQL API for Manga #${anilistId} (Local #${mangaId})...`
      )
      const alData = await anilistProvider.fetchManga(anilistId)
      if (!alData) {
        logger.warn(
          `${c.yellow('⚠️ [AniList Empty]')}: No manga data returned for AniList #${anilistId}`
        )
        return { synced: false, discoveredRelations: [] }
      }

      const displayTitle = alData.title.userPreferred || alData.title.english || alData.title.romaji || 'Unknown'
      const genreRecords = await this.upsertGenres(alData.genres)
      logger.info(
        `${c.magenta('📥 [1/2]')} AniList received: "${c.bold(displayTitle)}" (chapters=${alData.chapters || 'N/A'}, volumes=${alData.volumes || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Manga #${mangaId} record to database...`)
      await prisma.orm.public.Manga.where({ id: mangaId }).update({
        titlePrimary:
          alData.title.english ||
          alData.title.userPreferred ||
          alData.title.romaji ||
          undefined,
        titleSecondary: alData.title.romaji || alData.title.english || undefined,
        titleNative: alData.title.native || undefined,
        description: alData.description || undefined,
        coverImage: alData.coverImage?.medium || alData.coverImage?.large || undefined,
        bannerImage: alData.bannerImage || undefined,
        chapterCount: alData.chapters || undefined,
        volumeCount: alData.volumes || undefined,
        alAverageScore: alData.averageScore || undefined,
        alPopularity: alData.popularity || undefined,
        alFavorites: alData.favourites || undefined,
        startDateYear: alData.startDate?.year || undefined,
        format: (alData.format as any) || undefined,
        status: alData.status ? normalizeMediaStatus(alData.status) : undefined,
        alUpdatedAt: nowUnix,
        updatedAt: now,
      })

      if (genreRecords.length > 0) {
        try {
          await prisma.orm.public.MangaGenre.where({ mangaId }).deleteAll()
        } catch {}
        for (const g of genreRecords) {
          await prisma.orm.public.MangaGenre.create({ mangaId, genreId: g.id }).catch(() => {})
        }
      }

      // Sync Characters and Staff with medium image (fallback to large)
      await this.syncMediaCharacters('MANGA', mangaId, alData.characters)
      await this.syncMediaStaff('MANGA', mangaId, alData.staff)

      const discoveredRelations: DiscoveredRelation[] = []
      if (alData.relations?.edges && Array.isArray(alData.relations.edges)) {
        for (const edge of alData.relations.edges) {
          if (!edge?.node) continue

          const isMusic =
            edge.node.format === 'MUSIC' ||
            (edge.node.type as string) === 'MUSIC'

          if (isMusic) {
            await this.handleMusicRelation('MANGA', mangaId, edge)
            continue
          }

          const rawRelType = edge.relationType
          if (!rawRelType) continue
          const relType = mapRelationType(rawRelType)
          if (relType === 'UNKNOWN') continue

          const targetType: MediaType = edge.node.type === 'MANGA' ? 'MANGA' : 'ANIME'
          const targetExternalId = edge.node.id
          if (!targetExternalId) continue

          let localTargetId: number
          if (targetType === 'ANIME') {
            let targetAnime = await prisma.orm.public.Anime.where({ anilistId: targetExternalId })
              .select('id')
              .first()
            if (!targetAnime) {
              const targetTitle =
                edge.node.title?.english ||
                edge.node.title?.userPreferred ||
                edge.node.title?.romaji ||
                `Anime #${targetExternalId}`
              targetAnime = await prisma.orm.public.Anime.create({
                anilistId: targetExternalId,
                titlePrimary: targetTitle,
                titleSecondary: edge.node.title?.romaji || edge.node.title?.english || null,
                titleNative: edge.node.title?.native || null,
                coverImage: edge.node.coverImage?.medium || edge.node.coverImage?.large || null,
                format: mapAnimeFormat(edge.node.format),
                synonyms: [],
              })
            }
            localTargetId = targetAnime.id
          } else {
            let targetManga = await prisma.orm.public.Manga.where({ anilistId: targetExternalId })
              .select('id')
              .first()
            if (!targetManga) {
              const targetTitle =
                edge.node.title?.english ||
                edge.node.title?.userPreferred ||
                edge.node.title?.romaji ||
                `Manga #${targetExternalId}`
              targetManga = await prisma.orm.public.Manga.create({
                anilistId: targetExternalId,
                titlePrimary: targetTitle,
                titleSecondary: edge.node.title?.romaji || edge.node.title?.english || null,
                titleNative: edge.node.title?.native || null,
                coverImage: edge.node.coverImage?.medium || edge.node.coverImage?.large || null,
                format: mapMangaFormat(edge.node.format),
                synonyms: [],
              })
            }
            localTargetId = targetManga.id
          }

          const existingRel = await prisma.orm.public.MediaRelation.where({
            sourceType: 'MANGA',
            sourceId: mangaId,
            targetType,
            targetId: localTargetId,
            type: relType,
          }).first()

          if (!existingRel) {
            await prisma.orm.public.MediaRelation.create({
              sourceType: 'MANGA',
              sourceId: mangaId,
              targetType,
              targetId: localTargetId,
              type: relType,
            }).catch(() => {})
          }

          discoveredRelations.push({
            sourceType: 'MANGA',
            sourceId: mangaId,
            sourceExternalId: anilistId,
            targetType,
            targetExternalId,
            targetLocalId: localTargetId,
            type: relType,
          })
        }
      }

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Manga #${mangaId} ("${displayTitle}") with ${discoveredRelations.length} relations`
      )
      return { synced: true, discoveredRelations }
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Manga #${mangaId}: ${err?.message || err}`)
      return { synced: false, discoveredRelations: [] }
    }
  }

  /**
   * Fully synchronizes a TV entity from TheTVDB.
   */
  static async syncTv(tvId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let tvdbId: number | null = externalId ? Number(externalId) : null
      if (!tvdbId) {
        const record = await prisma.orm.public.Tv.where({ id: tvId })
          .select('tvDBId')
          .first()
        tvdbId = record?.tvDBId ?? null
      }

      if (!tvdbId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync TV #${tvId}: missing TVDB ID`)
        return false
      }

      logger.info(
        `${c.blue('📡 [1/2]')} Querying TheTVDB API v4 for TV Series #${tvdbId} (Local #${tvId})...`
      )
      const series = await tvdbProvider.fetchTvSeries(tvdbId)
      if (!series) {
        logger.warn(
          `${c.yellow('⚠️ [TVDB Empty]')}: No series data returned for TVDB #${tvdbId}`
        )
        return false
      }

      const displayTitle = series.name || 'Unknown TV Series'
      const genreNames = series.genres?.map((g) => g.name).filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      logger.info(
        `${c.blue('📥 [1/2]')} TVDB received Series: "${c.bold(displayTitle)}" (firstAired=${series.firstAired || 'N/A'}, score=${series.score || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting TV Series #${tvId} record to database...`)
      await prisma.orm.public.Tv.where({ id: tvId }).update({
        titlePrimary: series.name || undefined,
        description: series.overview || undefined,
        coverImage: series.image || undefined,
        firstAiredYear: series.firstAired ? parseInt(series.firstAired.slice(0, 4), 10) : undefined,
        tvdbUpdatedAt: nowUnix,
        updatedAt: now,
      })

      if (genreRecords.length > 0) {
        try {
          await prisma.orm.public.TvGenre.where({ tvId }).deleteAll()
        } catch {}
        for (const g of genreRecords) {
          await prisma.orm.public.TvGenre.create({ tvId, genreId: g.id }).catch(() => {})
        }
      }

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced TV Series #${tvId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync TV #${tvId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Movie entity from TheTVDB.
   */
  static async syncMovie(movieId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let tvdbId: number | null = externalId ? Number(externalId) : null
      if (!tvdbId) {
        const record = await prisma.orm.public.Movie.where({ id: movieId })
          .select('tvDBId')
          .first()
        tvdbId = record?.tvDBId ?? null
      }

      if (!tvdbId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Movie #${movieId}: missing TVDB ID`)
        return false
      }

      logger.info(
        `${c.blue('📡 [1/2]')} Querying TheTVDB API v4 for Movie #${tvdbId} (Local #${movieId})...`
      )
      const movie = await tvdbProvider.fetchMovie(tvdbId)
      if (!movie) {
        logger.warn(
          `${c.yellow('⚠️ [TVDB Empty]')}: No movie data returned for TVDB #${tvdbId}`
        )
        return false
      }

      const displayTitle = movie.name || 'Unknown Movie'
      const genreNames = movie.genres?.map((g) => g.name).filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      logger.info(
        `${c.blue('📥 [1/2]')} TVDB received Movie: "${c.bold(displayTitle)}" (runtime=${movie.runtime || 'N/A'}m, score=${movie.score || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Movie #${movieId} record to database...`)
      await prisma.orm.public.Movie.where({ id: movieId }).update({
        titlePrimary: movie.name || undefined,
        description: movie.overview || undefined,
        coverImage: movie.image || undefined,
        runtime: movie.runtime || undefined,
        releaseDateYear: movie.first_release_date ? parseInt(movie.first_release_date.slice(0, 4), 10) : undefined,
        tvdbUpdatedAt: nowUnix,
        updatedAt: now,
      })

      if (genreRecords.length > 0) {
        try {
          await prisma.orm.public.MovieGenre.where({ movieId }).deleteAll()
        } catch {}
        for (const g of genreRecords) {
          await prisma.orm.public.MovieGenre.create({ movieId, genreId: g.id }).catch(() => {})
        }
      }

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Movie #${movieId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Movie #${movieId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Game entity from IGDB.
   */
  static async syncGame(gameId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let igdbId: number | null = externalId ? Number(externalId) : null
      if (!igdbId) {
        const record = await prisma.orm.public.Game.where({ id: gameId })
          .select('igdbId')
          .first()
        igdbId = record?.igdbId ?? null
      }

      if (!igdbId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Game #${gameId}: missing IGDB ID`)
        return false
      }

      logger.info(
        `${c.magenta('📡 [1/2]')} Querying IGDB API v4 for Game #${igdbId} (Local #${gameId})...`
      )
      const game = await igdbProvider.fetchGame(igdbId)
      if (!game) {
        logger.warn(
          `${c.yellow('⚠️ [IGDB Empty]')}: No game data returned for IGDB #${igdbId}`
        )
        return false
      }

      const displayTitle = game.name || 'Unknown Game'
      const genreNames = game.genres?.map((g) => g.name).filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      const platforms = game.platforms?.map((p) => p.name).filter(Boolean) || []
      logger.info(
        `${c.magenta('📥 [1/2]')} IGDB received Game: "${c.bold(displayTitle)}" (rating=${game.rating ? Math.round(game.rating) : 'N/A'}, platforms=${platforms.length}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Game #${gameId} record to database...`)
      await prisma.orm.public.Game.where({ id: gameId }).update({
        titlePrimary: game.name || undefined,
        description: game.summary || game.storyline || undefined,
        coverImage: game.cover?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
          : undefined,
        releaseDateYear: game.first_release_date
          ? new Date(game.first_release_date * 1000).getUTCFullYear()
          : undefined,
        igdbRating: game.rating ? Math.round(game.rating * 10) / 10 : undefined,
        igdbRatingCount: (game as any).rating_count || undefined,
        platforms,
        igdbUpdatedAt: nowUnix,
        updatedAt: now,
      })

      if (genreRecords.length > 0) {
        try {
          await prisma.orm.public.GameGenre.where({ gameId }).deleteAll()
        } catch {}
        for (const g of genreRecords) {
          await prisma.orm.public.GameGenre.create({ gameId, genreId: g.id }).catch(() => {})
        }
      }

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Game #${gameId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Game #${gameId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Book entity from Google Books.
   */
  static async syncBook(bookId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let volumeId: string | null = externalId ? String(externalId) : null
      if (!volumeId) {
        const record = await prisma.orm.public.Book.where({ id: bookId })
          .select('googleBookId')
          .first()
        volumeId = record?.googleBookId ?? null
      }

      if (!volumeId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Book #${bookId}: missing Google Books ID`)
        return false
      }

      logger.info(
        `${c.yellow('📡 [1/2]')} Querying Google Books API for Volume "${volumeId}" (Local #${bookId})...`
      )
      const book = await googleBooksProvider.fetchBook(volumeId)
      if (!book) {
        logger.warn(
          `${c.yellow('⚠️ [Google Books Empty]')}: No book data returned for Google Books ID "${volumeId}"`
        )
        return false
      }

      const info = book.volumeInfo || {}
      const displayTitle = info.title || 'Unknown Book'
      const genreNames = info.categories?.filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      logger.info(
        `${c.yellow('📥 [1/2]')} Google Books received: "${c.bold(displayTitle)}" (pages=${info.pageCount || 'N/A'}, authors=${info.authors?.join(', ') || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      let releaseDateYear: number | undefined
      if (info.publishedDate) {
        const yr = parseInt(info.publishedDate.slice(0, 4), 10)
        if (!isNaN(yr)) releaseDateYear = yr
      }

      logger.info(`${c.blue('💾 [2/2]')} Upserting Book #${bookId} record to database...`)
      await prisma.orm.public.Book.where({ id: bookId }).update({
        titlePrimary: info.title || undefined,
        titleSecondary: info.subtitle || undefined,
        description: info.description || undefined,
        pageCount: info.pageCount || undefined,
        authors: info.authors || undefined,
        publishers: info.publisher ? [info.publisher] : undefined,
        releaseDateYear,
        googleBooksRating: (info as any).averageRating || undefined,
        googleBooksRatingsCount: (info as any).ratingsCount || undefined,
        googleBooksUpdatedAt: nowUnix,
        updatedAt: now,
      })

      if (genreRecords.length > 0) {
        try {
          await prisma.orm.public.BookGenre.where({ bookId }).deleteAll()
        } catch {}
        for (const g of genreRecords) {
          await prisma.orm.public.BookGenre.create({ bookId, genreId: g.id }).catch(() => {})
        }
      }

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Book #${bookId} ("${displayTitle}")`
      )
      return true
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Book #${bookId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Fully synchronizes a Music entity from Deezer.
   */
  static async syncMusic(musicId: number, externalId?: number | string | null): Promise<boolean> {
    try {
      let deezerId: string | null = externalId ? String(externalId) : null
      if (!deezerId) {
        const record = await prisma.orm.public.Music.where({ id: musicId })
          .select('deezerId', 'type')
          .first()
        deezerId = record?.deezerId ?? null
      }

      if (!deezerId) {
        logger.warn(`${c.yellow('⚠️ [Missing ID]')}: Cannot sync Music #${musicId}: missing Deezer ID`)
        return false
      }

      logger.info(
        `${c.cyan('📡 [1/2]')} Querying Deezer API for Track/Album #${deezerId} (Local #${musicId})...`
      )
      const track = await deezerProvider.getTrack(deezerId)
      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      if (track) {
        logger.info(
          `${c.cyan('📥 [1/2]')} Deezer received Track: "${c.bold(track.title)}" (artist=${track.artist?.name || 'N/A'}, duration=${track.duration || 0}s)`
        )
        logger.info(`${c.blue('💾 [2/2]')} Upserting Music Track #${musicId} record to database...`)
        await prisma.orm.public.Music.where({ id: musicId }).update({
          titlePrimary: track.title || undefined,
          artistName: track.artist?.name || undefined,
          duration: track.duration || undefined,
          audioPreviewUrl: track.preview || undefined,
          deezerUpdatedAt: nowUnix,
          updatedAt: now,
        })
        logger.info(
          `${c.green('✅ [Sync Complete]')} Successfully synced Music Track #${musicId} ("${track.title}")`
        )
        return true
      }

      const album = await deezerProvider.getAlbum(deezerId)
      if (album) {
        logger.info(
          `${c.cyan('📥 [1/2]')} Deezer received Album: "${c.bold(album.title)}" (artist=${album.artist?.name || 'N/A'}, duration=${album.duration || 0}s)`
        )
        logger.info(`${c.blue('💾 [2/2]')} Upserting Music Album #${musicId} record to database...`)
        await prisma.orm.public.Music.where({ id: musicId }).update({
          titlePrimary: album.title || undefined,
          artistName: album.artist?.name || undefined,
          duration: album.duration || undefined,
          deezerUpdatedAt: nowUnix,
          updatedAt: now,
        })
        logger.info(
          `${c.green('✅ [Sync Complete]')} Successfully synced Music Album #${musicId} ("${album.title}")`
        )
        return true
      }

      logger.warn(
        `${c.yellow('⚠️ [Deezer Empty]')}: No track or album data returned for Deezer ID "${deezerId}"`
      )
      return false
    } catch (err: any) {
      logger.error(`${c.red('❌ [Sync Error]')}: Failed to sync Music #${musicId}: ${err?.message || err}`)
      return false
    }
  }

  /**
   * Routes entity sync based on media type and returns EntitySyncResult.
   */
  static async syncEntity(
    mediaType: string,
    mediaId: number,
    externalId?: number | string | null
  ): Promise<EntitySyncResult> {
    const norm = mediaType.toUpperCase()
    switch (norm) {
      case 'ANIME':
        return await this.syncAnime(mediaId, externalId)
      case 'MANGA':
        return await this.syncManga(mediaId, externalId)
      case 'TV': {
        const synced = await this.syncTv(mediaId, externalId)
        return { synced, discoveredRelations: [] }
      }
      case 'MOVIE': {
        const synced = await this.syncMovie(mediaId, externalId)
        return { synced, discoveredRelations: [] }
      }
      case 'GAME': {
        const synced = await this.syncGame(mediaId, externalId)
        return { synced, discoveredRelations: [] }
      }
      case 'BOOK': {
        const synced = await this.syncBook(mediaId, externalId)
        return { synced, discoveredRelations: [] }
      }
      case 'MUSIC': {
        const synced = await this.syncMusic(mediaId, externalId)
        return { synced, discoveredRelations: [] }
      }
      default:
        logger.warn(`${c.yellow('⚠️ [Unknown Type]')}: Unsupported media type for sync: ${mediaType}`)
        return { synced: false, discoveredRelations: [] }
    }
  }
}
