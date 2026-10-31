import { prisma, normalizeMediaStatus, type RelationType } from '@Iris/db'
import { LogFactory, c } from '@Iris/logger'
import {
  anilistProvider,
  type AniListAnimePayload,
  type AniListMangaPayload,
  tvdbProvider,
  normalizeTvdbImageUrl,
  type TvdbCharacter,
  type TvdbEpisode,
  igdbProvider,
  googleBooksProvider,
  deezerProvider,
} from '../providers'
import {
  MediaPreviewSyncer,
  mapAnimeFormat,
  mapMangaFormat,
  mapMovieStatus,
  mapTvStatus,
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

  private static async upsertTags(
    tags?: Array<string | { name?: string; tag?: string; tagName?: string; category?: string; description?: string; helpText?: string }>
  ): Promise<Array<{ id: number }>> {
    if (!tags || tags.length === 0) return []
    const results: Array<{ id: number }> = []
    const seen = new Set<string>()

    for (const item of tags) {
      const rawName = typeof item === 'string' ? item : item.name || item.tag || item.tagName
      const name = rawName?.trim()
      if (!name || !isNaN(Number(name))) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const slug = key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'tag'
      const category = typeof item === 'object' ? item.category?.trim() || item.tagName?.trim() : undefined
      const description = typeof item === 'object' ? item.description?.trim() || item.helpText?.trim() : undefined

      try {
        let tag = await prisma.orm.public.Tag.where({ name }).select('id').first()
        if (!tag) {
          tag = await prisma.orm.public.Tag.create({
            name,
            slug,
            category: category || null,
            description: description || null,
          })
        }
        results.push({ id: tag.id })
      } catch {
        try {
          const fallback = await prisma.orm.public.Tag.where({ name }).select('id').first()
          if (fallback) results.push({ id: fallback.id })
        } catch {}
      }
    }
    return results
  }

  private static async upsertStudio(data: {
    name: string
    anilistId?: number
    tvDBId?: number
    isAnimationStudio?: boolean
    siteUrl?: string
  }): Promise<{ id: number }> {
    const cleanName = data.name.trim()
    try {
      if (data.tvDBId) {
        const existing = await prisma.orm.public.Studio.where({ tvDBId: data.tvDBId }).select('id').first()
        if (existing) return existing
      }
      if (data.anilistId) {
        const existing = await prisma.orm.public.Studio.where({ anilistId: data.anilistId }).select('id').first()
        if (existing) return existing
      }
      const existingByName = await prisma.orm.public.Studio.where({ name: cleanName }).select('id').first()
      if (existingByName) return existingByName

      return await prisma.orm.public.Studio.create({
        name: cleanName,
        tvDBId: data.tvDBId || null,
        anilistId: data.anilistId || null,
        isAnimationStudio: data.isAnimationStudio || false,
        siteUrl: data.siteUrl || null,
      })
    } catch {
      const fallback = await prisma.orm.public.Studio.where({ name: cleanName }).select('id').first()
      if (fallback) return fallback
      throw new Error(`Failed to upsert studio "${cleanName}"`)
    }
  }

  private static async linkMediaStudio(
    mediaType: 'ANIME' | 'MOVIE' | 'TV' | 'GAME' | 'BOOK',
    mediaId: number,
    studioId: number,
    isMain = false
  ): Promise<void> {
    try {
      const existing = await prisma.orm.public.MediaStudio.where({
        mediaType,
        mediaId,
        studioId,
      }).select('id').first()

      if (!existing) {
        await prisma.orm.public.MediaStudio.create({
          mediaType,
          mediaId,
          studioId,
          isMain,
          animeId: mediaType === 'ANIME' ? mediaId : null,
          movieId: mediaType === 'MOVIE' ? mediaId : null,
          tvId: mediaType === 'TV' ? mediaId : null,
          gameId: mediaType === 'GAME' ? mediaId : null,
          bookId: mediaType === 'BOOK' ? mediaId : null,
        })
      }
    } catch {}
  }

  private static async syncTvdbCharactersAndStaff(
    mediaType: 'MOVIE' | 'TV',
    mediaId: number,
    characters?: TvdbCharacter[]
  ): Promise<void> {
    if (!characters || !Array.isArray(characters) || characters.length === 0) return

    const seenCast = new Set<string>()
    for (const c of characters) {
      const key = `${c.id}_${c.peopleId}_${c.name}_${c.personName}`
      if (seenCast.has(key)) continue
      seenCast.add(key)

      const isActor =
        !c.peopleType ||
        c.peopleType.toLowerCase() === 'actor' ||
        c.type === 3 ||
        (c.typeName && c.typeName.toLowerCase() === 'actor')

      let personRecord: { id: number; image?: string | null } | null = null
      if (c.personName || c.peopleId) {
        const pName = (c.personName || 'Unknown Person').trim()
        const pImg = normalizeTvdbImageUrl(c.personImgURL)
        if (c.peopleId) {
          personRecord = await prisma.orm.public.Person.where({ tvDBId: c.peopleId }).select('id', 'image').first()
        }
        if (!personRecord) {
          personRecord = await prisma.orm.public.Person.where({ namePrimary: pName }).select('id', 'image').first()
        }
        if (!personRecord) {
          personRecord = await prisma.orm.public.Person.create({
            tvDBId: c.peopleId || null,
            namePrimary: pName,
            nameAlternative: [],
            image: pImg,
            primaryOccupations: [],
            yearsActive: [],
          }).catch(() => null)
        } else if (!personRecord.image && pImg) {
          await prisma.orm.public.Person.where({ id: personRecord.id }).update({ image: pImg }).catch(() => {})
        }
      }

      let charRecord: { id: number; image?: string | null } | null = null
      if (c.name && isActor) {
        const cName = c.name.trim()
        const cImg = normalizeTvdbImageUrl(c.image)
        if (c.id) {
          charRecord = await prisma.orm.public.Character.where({ tvDBId: c.id }).select('id', 'image').first()
        }
        if (!charRecord) {
          charRecord = await prisma.orm.public.Character.where({ namePrimary: cName }).select('id', 'image').first()
        }
        if (!charRecord) {
          charRecord = await prisma.orm.public.Character.create({
            tvDBId: c.id || null,
            namePrimary: cName,
            nameAlternative: [],
            nameAlternativeSpoiler: [],
            image: cImg,
            favorites: 0,
          }).catch(() => null)
        } else if (!charRecord.image && cImg) {
          await prisma.orm.public.Character.where({ id: charRecord.id }).update({ image: cImg }).catch(() => {})
        }
      }

      if (isActor && charRecord) {
        const role = c.isFeatured ? 'MAIN' : 'SUPPORTING'
        const existingMC = await prisma.orm.public.MediaCharacter.where({
          mediaType,
          mediaId,
          characterId: charRecord.id,
        }).select('id', 'actorId').first()

        if (existingMC) {
          if (personRecord && existingMC.actorId !== personRecord.id) {
            await prisma.orm.public.MediaCharacter.where({ id: existingMC.id }).update({
              actorId: personRecord.id,
              role,
              movieId: mediaType === 'MOVIE' ? mediaId : null,
              tvId: mediaType === 'TV' ? mediaId : null,
            }).catch(() => {})
          }
        } else {
          await prisma.orm.public.MediaCharacter.create({
            mediaType,
            mediaId,
            characterId: charRecord.id,
            actorId: personRecord?.id || null,
            role,
            movieId: mediaType === 'MOVIE' ? mediaId : null,
            tvId: mediaType === 'TV' ? mediaId : null,
          }).catch(() => {})
        }
      } else if (personRecord) {
        const rawRole = (c.typeName || c.peopleType || (isActor ? 'CAST' : 'OTHER')).toUpperCase()
        let staffRole: any = 'OTHER'
        if (rawRole.includes('DIRECTOR')) staffRole = 'DIRECTOR'
        else if (rawRole.includes('WRITER') || rawRole.includes('SCRIPT')) staffRole = 'SCRIPT'
        else if (rawRole.includes('PRODUCER')) staffRole = rawRole.includes('EXEC') ? 'EXECUTIVE_PRODUCER' : 'PRODUCER'
        else if (rawRole.includes('MUSIC') || rawRole.includes('COMPOSER')) staffRole = 'COMPOSER'
        else if (rawRole.includes('ACTOR') || rawRole.includes('CAST')) staffRole = 'CAST'
        else if (rawRole.includes('AUTHOR')) staffRole = 'AUTHOR'
        else if (rawRole.includes('ART') || rawRole.includes('ILLUSTRAT')) staffRole = 'ILLUSTRATOR'

        const existingMS = await prisma.orm.public.MediaStaff.where({
          mediaType,
          mediaId,
          personId: personRecord.id,
          role: staffRole,
        }).select('id').first()

        if (!existingMS) {
          await prisma.orm.public.MediaStaff.create({
            mediaType,
            mediaId,
            personId: personRecord.id,
            role: staffRole,
            customRole: c.typeName || c.peopleType || null,
            movieId: mediaType === 'MOVIE' ? mediaId : null,
            tvId: mediaType === 'TV' ? mediaId : null,
          }).catch(() => {})
        }
      }
    }
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
      const charImage = edge.node.image?.large || edge.node.image?.medium || null

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
            const vaImage = va.image?.large || va.image?.medium || null
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
      const staffImage = edge.node.image?.large || edge.node.image?.medium || null

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
        coverImage: alData.coverImage?.extraLarge || alData.coverImage?.large || alData.coverImage?.medium || undefined,
        bannerImage: alData.bannerImage || undefined,
        episodeCount: alData.episodes || undefined,
        alAverageScore: alData.averageScore || undefined,
        alPopularity: alData.popularity || undefined,
        alFavorites: alData.favourites || undefined,
        seasonYear: alData.seasonYear || undefined,
        seasonSeason: (alData.season as any) || undefined,
        format: (alData.format as any) || undefined,
        status: alData.status ? normalizeMediaStatus(alData.status) : undefined,
        startDateYear: alData.startDate?.year || undefined,
        startDateMonth: alData.startDate?.month || undefined,
        startDateDay: alData.startDate?.day || undefined,
        endDateYear: alData.endDate?.year || undefined,
        endDateMonth: alData.endDate?.month || undefined,
        endDateDay: alData.endDate?.day || undefined,
        countryOfOrigin: alData.countryOfOrigin || undefined,
        synonyms: alData.synonyms && alData.synonyms.length > 0 ? alData.synonyms : undefined,
        trailers: alData.trailer ? [alData.trailer] : undefined,
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

      // Sync tags
      if ((alData as any).tags && Array.isArray((alData as any).tags)) {
        const tagRecords = await this.upsertTags((alData as any).tags)
        if (tagRecords.length > 0) {
          try {
            await prisma.orm.public.AnimeTag.where({ animeId }).deleteAll()
          } catch {}
          for (const t of tagRecords) {
            await prisma.orm.public.AnimeTag.create({ animeId, tagId: t.id }).catch(() => {})
          }
        }
      }

      // Sync studios
      if (alData.studios?.edges && Array.isArray(alData.studios.edges)) {
        for (const edge of alData.studios.edges) {
          if (!edge?.node?.name) continue
          try {
            const studio = await this.upsertStudio({
              name: edge.node.name,
              anilistId: edge.node.id,
              isAnimationStudio: edge.node.isAnimationStudio,
              siteUrl: edge.node.siteUrl,
            })
            await this.linkMediaStudio('ANIME', animeId, studio.id, Boolean(edge.isMain))
          } catch {}
        }
      }

      // Sync Characters, Voice Actors, and Staff with large image (fallback to medium)
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
                coverImage: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large || edge.node.coverImage?.medium || null,
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
                coverImage: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large || edge.node.coverImage?.medium || null,
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
        coverImage: alData.coverImage?.extraLarge || alData.coverImage?.large || alData.coverImage?.medium || undefined,
        bannerImage: alData.bannerImage || undefined,
        chapterCount: alData.chapters || undefined,
        volumeCount: alData.volumes || undefined,
        alAverageScore: alData.averageScore || undefined,
        alPopularity: alData.popularity || undefined,
        alFavorites: alData.favourites || undefined,
        startDateYear: alData.startDate?.year || undefined,
        startDateMonth: alData.startDate?.month || undefined,
        startDateDay: alData.startDate?.day || undefined,
        endDateYear: alData.endDate?.year || undefined,
        endDateMonth: alData.endDate?.month || undefined,
        endDateDay: alData.endDate?.day || undefined,
        countryOfOrigin: alData.countryOfOrigin || undefined,
        synonyms: alData.synonyms && alData.synonyms.length > 0 ? alData.synonyms : undefined,
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

      // Sync tags
      if ((alData as any).tags && Array.isArray((alData as any).tags)) {
        const tagRecords = await this.upsertTags((alData as any).tags)
        if (tagRecords.length > 0) {
          try {
            await prisma.orm.public.MangaTag.where({ mangaId }).deleteAll()
          } catch {}
          for (const t of tagRecords) {
            await prisma.orm.public.MangaTag.create({ mangaId, tagId: t.id }).catch(() => {})
          }
        }
      }

      // Sync Characters and Staff with large image (fallback to medium)
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
                coverImage: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large || edge.node.coverImage?.medium || null,
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
                coverImage: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large || edge.node.coverImage?.medium || null,
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

      const resolvedEng = series.engTranslation
      const titlePrimary = resolvedEng?.name?.trim() || series.name || 'Unknown TV Series'
      const titleSecondary = resolvedEng?.name && resolvedEng.name !== series.name ? series.name : undefined
      const titleNative =
        series.originalLanguage &&
        ['kor', 'jpn', 'zho', 'zhtw', 'ko', 'ja', 'zh'].includes(series.originalLanguage.toLowerCase())
          ? series.name
          : undefined

      const description = resolvedEng?.overview?.trim() || series.overview || undefined

      const genreNames = series.genres?.map((g) => g.name).filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      const tagRecords = await this.upsertTags(series.tags)

      logger.info(
        `${c.blue('📥 [1/2]')} TVDB received Series: "${c.bold(titlePrimary)}" (firstAired=${series.firstAired || 'N/A'}, score=${series.score || 'N/A'}, genres=${genreRecords.length})`
      )

      // Fetch episodes and characters in parallel
      const [episodes, tvCharacters] = await Promise.all([
        tvdbProvider.fetchTvEpisodes(tvdbId).catch(() => []),
        tvdbProvider.fetchTvCharacters(tvdbId).catch(() => []),
      ])

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      // First & Last Aired
      let firstAiredYear: number | undefined
      let firstAiredMonth: number | undefined
      let firstAiredDay: number | undefined
      if (series.firstAired) {
        const parts = series.firstAired.split('T')[0]?.split('-').map((s) => parseInt(s, 10)) || []
        if (parts[0] && !isNaN(parts[0])) firstAiredYear = parts[0]
        if (parts[1] && !isNaN(parts[1])) firstAiredMonth = parts[1]
        if (parts[2] && !isNaN(parts[2])) firstAiredDay = parts[2]
      }

      let lastAiredYear: number | undefined
      let lastAiredMonth: number | undefined
      let lastAiredDay: number | undefined
      if (series.lastAired) {
        const parts = series.lastAired.split('T')[0]?.split('-').map((s) => parseInt(s, 10)) || []
        if (parts[0] && !isNaN(parts[0])) lastAiredYear = parts[0]
        if (parts[1] && !isNaN(parts[1])) lastAiredMonth = parts[1]
        if (parts[2] && !isNaN(parts[2])) lastAiredDay = parts[2]
      }

      // Remote IDs
      let imdbId: string | undefined
      let tmdbId: number | undefined
      if (series.remoteIds && Array.isArray(series.remoteIds)) {
        for (const r of series.remoteIds) {
          if (r.sourceName?.toUpperCase() === 'IMDB' || r.type === 2) {
            imdbId = r.id
          } else if (
            r.sourceName?.toLowerCase().includes('themoviedb') ||
            r.type === 12 ||
            r.type === 10
          ) {
            const p = parseInt(r.id, 10)
            if (!isNaN(p)) tmdbId = p
          }
        }
      }

      // Age Rating
      let ageRating: string | undefined
      let ageRatingGuide: string | undefined
      if (series.contentRatings && Array.isArray(series.contentRatings) && series.contentRatings.length > 0) {
        const usaRating =
          series.contentRatings.find((r) => r.country?.toLowerCase() === 'usa') ||
          series.contentRatings[0]
        if (usaRating) {
          ageRating = usaRating.name || usaRating.fullname || undefined
          ageRatingGuide = usaRating.description || undefined
        }
      }

      // Artworks
      const seriesImages: string[] = []
      if (series.image) {
        const norm = normalizeTvdbImageUrl(series.image)
        if (norm) seriesImages.push(norm)
      }
      if (series.artworks && Array.isArray(series.artworks)) {
        for (const art of series.artworks) {
          const norm = normalizeTvdbImageUrl(art.image)
          if (norm && !seriesImages.includes(norm)) seriesImages.push(norm)
        }
      }

      let bannerImage: string | undefined
      const backgroundArtworks = (series.artworks || []).filter(
        (a) => a.type === 3 || (a.image && a.image.includes('/backgrounds/'))
      )
      if (backgroundArtworks.length > 0) {
        bannerImage = normalizeTvdbImageUrl(backgroundArtworks[0]?.image) || undefined
      } else if (seriesImages.length > 1) {
        bannerImage = seriesImages[1]
      }

      // Synonyms
      const synonymsSet = new Set<string>()
      if (Array.isArray(series.aliases)) {
        for (const a of series.aliases as any[]) {
          if (typeof a === 'string' && a.trim()) {
            synonymsSet.add(a.trim())
          } else if (a && typeof a.name === 'string' && a.name.trim()) {
            synonymsSet.add(a.name.trim())
          }
        }
      }
      if (titleSecondary && titleSecondary !== titlePrimary) synonymsSet.add(titleSecondary)
      if (titleNative && titleNative !== titlePrimary) synonymsSet.add(titleNative)
      synonymsSet.delete(titlePrimary)
      const synonyms = Array.from(synonymsSet)

      // Sources
      const sources: Record<string, unknown> = {
        thetvdb: {
          id: series.id,
          slug: series.slug,
          url: series.slug
            ? `https://thetvdb.com/series/${series.slug}`
            : `https://thetvdb.com/dereferrer/series/${series.id}`,
        },
      }
      if (imdbId) {
        sources.imdb = { id: imdbId, url: `https://www.imdb.com/title/${imdbId}` }
      }
      if (tmdbId) {
        sources.tmdb = { id: tmdbId, url: `https://www.themoviedb.org/tv/${tmdbId}` }
      }

      // Broadcast days
      const broadcastDays: string[] = []
      if (series.airsDays) {
        for (const [day, active] of Object.entries(series.airsDays)) {
          if (active) broadcastDays.push(day.charAt(0).toUpperCase() + day.slice(1))
        }
      }

      const countryOfOrigin =
        series.production_countries?.[0]?.name ||
        (series.originalLanguage ? series.originalLanguage.toUpperCase() : undefined)

      // Filter valid non-special episodes
      const validEpisodes = episodes.filter((e) => e.seasonNumber > 0)
      const seasonNumbers = new Set<number>()
      if (series.seasons && Array.isArray(series.seasons)) {
        for (const s of series.seasons) {
          if (s.number > 0) seasonNumbers.add(s.number)
        }
      }
      for (const ep of validEpisodes) {
        seasonNumbers.add(ep.seasonNumber)
      }

      logger.info(`${c.blue('💾 [2/2]')} Upserting TV Series #${tvId} record to database...`)
      await prisma.orm.public.Tv.where({ id: tvId }).update({
        titlePrimary,
        titleSecondary: titleSecondary || undefined,
        titleNative: titleNative || undefined,
        description: description || undefined,
        coverImage: series.image ? normalizeTvdbImageUrl(series.image) || undefined : undefined,
        bannerImage: bannerImage || undefined,
        images: seriesImages.length > 0 ? { thetvdb: seriesImages } : undefined,
        sources: sources as any,
        firstAiredYear,
        firstAiredMonth,
        firstAiredDay,
        lastAiredYear,
        lastAiredMonth,
        lastAiredDay,
        averageRuntime: series.averageRuntime || undefined,
        episodeCount: validEpisodes.length || undefined,
        seasonCount: seasonNumbers.size || undefined,
        networks: series.networks?.map((n) => n.name).filter(Boolean) || undefined,
        broadcastTime: series.airsTime || undefined,
        broadcastDays: broadcastDays.length > 0 ? broadcastDays : undefined,
        countryOfOrigin,
        originalLanguage: series.originalLanguage,
        status: mapTvStatus(series.status?.name),
        ageRating,
        ageRatingGuide,
        imdbId,
        tmdbId,
        synonyms,
        trailers: series.trailers || undefined,
        tvdbUpdatedAt: nowUnix,
        updatedAt: now,
      })

      // Sync genres
      if (genreRecords.length > 0) {
        try {
          await prisma.orm.public.TvGenre.where({ tvId }).deleteAll()
        } catch {}
        for (const g of genreRecords) {
          await prisma.orm.public.TvGenre.create({ tvId, genreId: g.id }).catch(() => {})
        }
      }

      // Sync tags
      if (tagRecords.length > 0) {
        try {
          await prisma.orm.public.TvTag.where({ tvId }).deleteAll()
        } catch {}
        for (const t of tagRecords) {
          await prisma.orm.public.TvTag.create({ tvId, tagId: t.id }).catch(() => {})
        }
      }

      // Upsert TV seasons and episodes
      const seasonMap = new Map<number, number>()
      for (const sNum of seasonNumbers) {
        const seasonMeta = series.seasons?.find((s) => s.number === sNum)
        const seasonEpisodes = validEpisodes.filter((e) => e.seasonNumber === sNum)

        let airDateYear: number | undefined
        let airDateMonth: number | undefined
        let airDateDay: number | undefined

        const firstEp = seasonEpisodes[0]
        if (firstEp?.aired) {
          const parts = firstEp.aired.split('-').map((s) => parseInt(s, 10))
          if (parts[0]) airDateYear = parts[0]
          if (parts[1]) airDateMonth = parts[1]
          if (parts[2]) airDateDay = parts[2]
        } else if (seasonMeta?.year) {
          airDateYear = parseInt(seasonMeta.year, 10) || undefined
        }

        const seasonPoster = seasonMeta?.image ? normalizeTvdbImageUrl(seasonMeta.image) : undefined

        let localSeason = await prisma.orm.public.TvSeason.where({
          tvId,
          seasonNumber: sNum,
        }).select('id').first()

        if (localSeason) {
          await prisma.orm.public.TvSeason.where({ id: localSeason.id }).update({
            tvdbSeasonId: seasonMeta?.id || undefined,
            titlePrimary: seasonMeta?.name || `Season ${sNum}`,
            posterImage: seasonPoster || undefined,
            airDateYear: airDateYear || undefined,
            airDateMonth: airDateMonth || undefined,
            airDateDay: airDateDay || undefined,
            episodeCount: seasonEpisodes.length || undefined,
          }).catch(() => {})
        } else {
          localSeason = await prisma.orm.public.TvSeason.create({
            tvId,
            seasonNumber: sNum,
            tvdbSeasonId: seasonMeta?.id || null,
            titlePrimary: seasonMeta?.name || `Season ${sNum}`,
            posterImage: seasonPoster || null,
            airDateYear: airDateYear || null,
            airDateMonth: airDateMonth || null,
            airDateDay: airDateDay || null,
            episodeCount: seasonEpisodes.length || 0,
          }).catch(() => null)
        }

        if (localSeason) {
          seasonMap.set(sNum, localSeason.id)
        }
      }

      for (const ep of validEpisodes) {
        const localSeasonId = seasonMap.get(ep.seasonNumber) || null
        let epAirDate: Date | undefined
        if (ep.aired) {
          const parsed = new Date(ep.aired)
          if (!isNaN(parsed.getTime())) epAirDate = parsed
        }

        const existingEp = await prisma.orm.public.TvEpisode.where({
          tvId,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.number,
        }).select('id').first()

        const epTitle = ep.name || `Episode ${ep.number}`
        const epThumb = ep.image ? normalizeTvdbImageUrl(ep.image) : undefined

        if (existingEp) {
          await prisma.orm.public.TvEpisode.where({ id: existingEp.id }).update({
            seasonId: localSeasonId,
            titlePrimary: epTitle,
            description: ep.overview || undefined,
            duration: ep.runtime || undefined,
            thumbnail: epThumb || undefined,
            airDate: epAirDate || undefined,
          }).catch(() => {})
        } else {
          await prisma.orm.public.TvEpisode.create({
            tvId,
            seasonId: localSeasonId,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.number,
            titlePrimary: epTitle,
            description: ep.overview || null,
            duration: ep.runtime || null,
            thumbnail: epThumb || null,
            airDate: epAirDate || null,
          }).catch(() => {})
        }
      }

      // Sync Studios / Companies
      const allCompanies = [
        ...(series.companies?.studio || []),
        ...(series.companies?.network || []),
        ...(series.companies?.production || []),
        ...(series.companies?.distributor || []),
      ]
      for (const comp of allCompanies) {
        if (!comp.name?.trim()) continue
        const studio = await this.upsertStudio({
          name: comp.name.trim(),
          tvDBId: comp.id,
        })
        await this.linkMediaStudio('TV', tvId, studio.id)
      }

      // Sync Characters, Cast, Staff
      const allCastAndStaff = [
        ...(tvCharacters || []),
        ...(series.characters || []),
      ]
      if (allCastAndStaff.length > 0) {
        await this.syncTvdbCharactersAndStaff('TV', tvId, allCastAndStaff)
      }

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced TV Series #${tvId} ("${titlePrimary}") with ${validEpisodes.length} episodes across ${seasonNumbers.size} seasons`
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

      const displayTitle = movie.engTranslation?.name?.trim() || movie.name || 'Unknown Movie'
      const genreNames = movie.genres?.map((g) => g.name).filter(Boolean)
      const genreRecords = await this.upsertGenres(genreNames)
      const tagRecords = await this.upsertTags(movie.tags)
      logger.info(
        `${c.blue('📥 [1/2]')} TVDB received Movie: "${c.bold(displayTitle)}" (runtime=${movie.runtime || 'N/A'}m, score=${movie.score || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      // Remote IDs (IMDb, TMDb)
      let imdbId: string | undefined
      let tmdbId: number | undefined
      if (movie.remoteIds && Array.isArray(movie.remoteIds)) {
        for (const r of movie.remoteIds) {
          if (r.sourceName?.toUpperCase() === 'IMDB' || r.type === 2) {
            imdbId = r.id
          } else if (
            r.sourceName?.toLowerCase().includes('themoviedb') ||
            r.type === 10
          ) {
            const p = parseInt(r.id, 10)
            if (!isNaN(p)) tmdbId = p
          }
        }
      }

      // Release Date
      let releaseDateYear: number | undefined
      let releaseDateMonth: number | undefined
      let releaseDateDay: number | undefined
      const rawReleaseDate =
        movie.first_release_date ||
        movie.first_release?.date ||
        (movie.releases && movie.releases.length > 0 ? movie.releases[0]?.date : undefined)

      if (rawReleaseDate) {
        const parts = rawReleaseDate.split('-').map((s) => parseInt(s, 10))
        if (parts[0] && !isNaN(parts[0])) releaseDateYear = parts[0]
        if (parts[1] && !isNaN(parts[1])) releaseDateMonth = parts[1]
        if (parts[2] && !isNaN(parts[2])) releaseDateDay = parts[2]
      }

      // Budget & Revenue
      let budget: bigint | undefined
      if (movie.budget) {
        const num = BigInt(String(movie.budget).replace(/[^0-9]/g, '') || 0)
        if (num > 0n) budget = num
      }
      let revenue: bigint | undefined
      if (movie.boxOffice) {
        const num = BigInt(String(movie.boxOffice).replace(/[^0-9]/g, '') || 0)
        if (num > 0n) revenue = num
      }

      // Age Rating
      let ageRating: string | undefined
      let ageRatingGuide: string | undefined
      if (movie.contentRatings && Array.isArray(movie.contentRatings) && movie.contentRatings.length > 0) {
        const usaRating =
          movie.contentRatings.find((r) => r.country?.toLowerCase() === 'usa') ||
          movie.contentRatings[0]
        if (usaRating) {
          ageRating = usaRating.name || usaRating.fullname || undefined
          ageRatingGuide = usaRating.description || undefined
        }
      }

      // Artworks, Cover, Banner, Images
      const movieImages: string[] = []
      if (movie.image) {
        const norm = normalizeTvdbImageUrl(movie.image)
        if (norm) movieImages.push(norm)
      }
      if (movie.artworks && Array.isArray(movie.artworks)) {
        for (const art of movie.artworks) {
          const norm = normalizeTvdbImageUrl(art.image)
          if (norm && !movieImages.includes(norm)) movieImages.push(norm)
        }
      }

      let bannerImage: string | undefined
      const backgroundArtworks = (movie.artworks || []).filter(
        (a) => a.type === 3 || (a.image && a.image.includes('/backgrounds/'))
      )
      if (backgroundArtworks.length > 0) {
        bannerImage = normalizeTvdbImageUrl(backgroundArtworks[0]?.image) || undefined
      } else if (movieImages.length > 1) {
        bannerImage = movieImages[1]
      }

      // Titles
      const resolvedEng = movie.engTranslation
      const titlePrimary = resolvedEng?.name?.trim() || movie.name || 'Unknown Movie'
      const titleSecondary = resolvedEng?.name && resolvedEng.name !== movie.name ? movie.name : undefined
      const titleNative =
        movie.originalLanguage &&
        ['kor', 'jpn', 'zho', 'zhtw', 'ko', 'ja', 'zh'].includes(movie.originalLanguage.toLowerCase())
          ? movie.name
          : undefined

      const description = resolvedEng?.overview?.trim() || movie.overview || undefined

      // Synonyms
      const synonymsSet = new Set<string>()
      if (Array.isArray(movie.aliases)) {
        for (const a of movie.aliases as any[]) {
          if (typeof a === 'string' && a.trim()) {
            synonymsSet.add(a.trim())
          } else if (a && typeof a.name === 'string' && a.name.trim()) {
            synonymsSet.add(a.name.trim())
          }
        }
      }
      if (titleSecondary && titleSecondary !== titlePrimary) synonymsSet.add(titleSecondary)
      if (titleNative && titleNative !== titlePrimary) synonymsSet.add(titleNative)
      synonymsSet.delete(titlePrimary)
      const synonyms = Array.from(synonymsSet)

      // Sources
      const sources: Record<string, unknown> = {
        thetvdb: {
          id: movie.id,
          slug: movie.slug,
          url: movie.slug
            ? `https://thetvdb.com/movies/${movie.slug}`
            : `https://thetvdb.com/dereferrer/movie/${movie.id}`,
        },
      }
      if (imdbId) {
        sources.imdb = { id: imdbId, url: `https://www.imdb.com/title/${imdbId}` }
      }
      if (tmdbId) {
        sources.tmdb = { id: tmdbId, url: `https://www.themoviedb.org/movie/${tmdbId}` }
      }

      const countryOfOrigin =
        movie.production_countries?.[0]?.name ||
        (movie.originalLanguage ? movie.originalLanguage.toUpperCase() : undefined)

      logger.info(`${c.blue('💾 [2/2]')} Upserting Movie #${movieId} record to database...`)
      await prisma.orm.public.Movie.where({ id: movieId }).update({
        titlePrimary,
        titleSecondary: titleSecondary || undefined,
        titleNative: titleNative || undefined,
        description: description || undefined,
        coverImage: movie.image ? normalizeTvdbImageUrl(movie.image) || undefined : undefined,
        bannerImage: bannerImage || undefined,
        images: movieImages.length > 0 ? { thetvdb: movieImages } : undefined,
        sources: sources as any,
        runtime: movie.runtime || undefined,
        releaseDateYear,
        releaseDateMonth,
        releaseDateDay,
        budget,
        revenue,
        status: mapMovieStatus(movie.status?.name),
        countryOfOrigin,
        originalLanguage: movie.originalLanguage,
        ageRating,
        ageRatingGuide,
        imdbId,
        tmdbId,
        synonyms,
        trailers: movie.trailers || undefined,
        tvdbUpdatedAt: nowUnix,
        updatedAt: now,
      })

      // Sync genres
      if (genreRecords.length > 0) {
        try {
          await prisma.orm.public.MovieGenre.where({ movieId }).deleteAll()
        } catch {}
        for (const g of genreRecords) {
          await prisma.orm.public.MovieGenre.create({ movieId, genreId: g.id }).catch(() => {})
        }
      }

      // Sync tags
      if (tagRecords.length > 0) {
        try {
          await prisma.orm.public.MovieTag.where({ movieId }).deleteAll()
        } catch {}
        for (const t of tagRecords) {
          await prisma.orm.public.MovieTag.create({ movieId, tagId: t.id }).catch(() => {})
        }
      }

      // Sync Studios / Companies
      const allCompanies = [
        ...(movie.companies?.studio || []),
        ...(movie.companies?.production || []),
        ...(movie.companies?.distributor || []),
      ]
      for (const comp of allCompanies) {
        if (!comp.name?.trim()) continue
        const studio = await this.upsertStudio({
          name: comp.name.trim(),
          tvDBId: comp.id,
        })
        await this.linkMediaStudio('MOVIE', movieId, studio.id)
      }

      // Sync Characters, Cast, Staff
      if (movie.characters && Array.isArray(movie.characters)) {
        await this.syncTvdbCharactersAndStaff('MOVIE', movieId, movie.characters)
      }

      logger.info(
        `${c.green('✅ [Sync Complete]')} Successfully synced Movie #${movieId} ("${titlePrimary}")`
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

      // Tags from themes and game modes
      const rawTags: Array<{ name: string; category?: string }> = []
      if (game.themes && Array.isArray(game.themes)) {
        for (const th of game.themes) {
          if (th.name) rawTags.push({ name: th.name, category: 'Theme' })
        }
      }
      if (game.game_modes && Array.isArray(game.game_modes)) {
        for (const gm of game.game_modes) {
          if (gm.name) rawTags.push({ name: gm.name, category: 'Game Mode' })
        }
      }
      const tagRecords = await this.upsertTags(rawTags)

      const platforms = game.platforms?.map((p) => p.name).filter(Boolean) || []
      logger.info(
        `${c.magenta('📥 [1/2]')} IGDB received Game: "${c.bold(displayTitle)}" (rating=${game.rating ? Math.round(game.rating) : 'N/A'}, platforms=${platforms.length}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      let releaseDateMonth: number | undefined
      let releaseDateDay: number | undefined
      if (game.first_release_date) {
        const d = new Date(game.first_release_date * 1000)
        releaseDateMonth = d.getUTCMonth() + 1
        releaseDateDay = d.getUTCDate()
      }

      const gameImages: string[] = []
      if (game.screenshots && Array.isArray(game.screenshots)) {
        for (const sc of game.screenshots) {
          if (sc.image_id) gameImages.push(`https://images.igdb.com/igdb/image/upload/t_screenshot_huge/${sc.image_id}.jpg`)
        }
      }
      if (game.artworks && Array.isArray(game.artworks)) {
        for (const art of game.artworks) {
          if (art.image_id) gameImages.push(`https://images.igdb.com/igdb/image/upload/t_1080p/${art.image_id}.jpg`)
        }
      }
      const bannerImage = gameImages[0] || undefined

      const synonyms = (game.alternative_names || []).map((a) => a.name).filter(Boolean)
      const sources: Record<string, unknown> = {
        igdb: {
          id: game.id,
          url: game.slug ? `https://www.igdb.com/games/${game.slug}` : `https://www.igdb.com/games/${game.id}`,
        },
      }
      if (game.websites && Array.isArray(game.websites)) {
        for (const ws of game.websites) {
          if (ws.url) sources[`website_${ws.category}`] = { url: ws.url }
        }
      }

      logger.info(`${c.blue('💾 [2/2]')} Upserting Game #${gameId} record to database...`)
      await prisma.orm.public.Game.where({ id: gameId }).update({
        titlePrimary: game.name || undefined,
        description: game.summary || game.storyline || undefined,
        coverImage: game.cover?.image_id
          ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.image_id}.jpg`
          : undefined,
        bannerImage,
        images: gameImages.length > 0 ? { igdb: gameImages } : undefined,
        releaseDateYear: game.first_release_date
          ? new Date(game.first_release_date * 1000).getUTCFullYear()
          : undefined,
        releaseDateMonth,
        releaseDateDay,
        igdbRating: game.rating ? Math.round(game.rating * 10) / 10 : undefined,
        igdbRatingCount: (game as any).rating_count || undefined,
        platforms,
        synonyms: synonyms.length > 0 ? synonyms : undefined,
        sources: sources as any,
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

      if (tagRecords.length > 0) {
        try {
          await prisma.orm.public.GameTag.where({ gameId }).deleteAll()
        } catch {}
        for (const t of tagRecords) {
          await prisma.orm.public.GameTag.create({ gameId, tagId: t.id }).catch(() => {})
        }
      }

      // Sync studios from involved companies
      if (game.involved_companies && Array.isArray(game.involved_companies)) {
        for (const ic of game.involved_companies) {
          if (!ic.company?.name?.trim()) continue
          try {
            const studio = await this.upsertStudio({ name: ic.company.name.trim() })
            await this.linkMediaStudio('GAME', gameId, studio.id, Boolean(ic.developer))
          } catch {}
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
      const tagRecords = await this.upsertTags(genreNames)
      logger.info(
        `${c.yellow('📥 [1/2]')} Google Books received: "${c.bold(displayTitle)}" (pages=${info.pageCount || 'N/A'}, authors=${info.authors?.join(', ') || 'N/A'}, genres=${genreRecords.length})`
      )

      const now = new Date()
      const nowUnix = Math.floor(now.getTime() / 1000)

      let releaseDateYear: number | undefined
      let releaseDateMonth: number | undefined
      let releaseDateDay: number | undefined
      if (info.publishedDate) {
        const parts = info.publishedDate.split('-').map((s) => parseInt(s, 10))
        if (parts[0] && !isNaN(parts[0])) releaseDateYear = parts[0]
        if (parts[1] && !isNaN(parts[1])) releaseDateMonth = parts[1]
        if (parts[2] && !isNaN(parts[2])) releaseDateDay = parts[2]
      }

      const cleanDescription = info.description ? info.description.replace(/<[^>]*>/g, '').trim() : undefined
      const imageLinks = (info as any).imageLinks
      const coverImage =
        imageLinks?.extraLarge ||
        imageLinks?.large ||
        imageLinks?.medium ||
        imageLinks?.thumbnail ||
        undefined

      const sources: Record<string, unknown> = {
        googleBooks: { id: volumeId, url: `https://books.google.com/books?id=${volumeId}` },
      }
      const industryIdentifiers = (info as any).industryIdentifiers
      if (industryIdentifiers && Array.isArray(industryIdentifiers)) {
        for (const idObj of industryIdentifiers) {
          if (idObj?.identifier) sources[idObj.type || 'identifier'] = idObj.identifier
        }
      }

      logger.info(`${c.blue('💾 [2/2]')} Upserting Book #${bookId} record to database...`)
      await prisma.orm.public.Book.where({ id: bookId }).update({
        titlePrimary: info.title || undefined,
        titleSecondary: info.subtitle || undefined,
        description: cleanDescription,
        coverImage,
        pageCount: info.pageCount || undefined,
        authors: info.authors || undefined,
        publishers: info.publisher ? [info.publisher] : undefined,
        releaseDateYear,
        releaseDateMonth,
        releaseDateDay,
        googleBooksRating: (info as any).averageRating || undefined,
        googleBooksRatingsCount: (info as any).ratingsCount || undefined,
        sources: sources as any,
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

      if (tagRecords.length > 0) {
        try {
          await prisma.orm.public.BookTag.where({ bookId }).deleteAll()
        } catch {}
        for (const t of tagRecords) {
          await prisma.orm.public.BookTag.create({ bookId, tagId: t.id }).catch(() => {})
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
