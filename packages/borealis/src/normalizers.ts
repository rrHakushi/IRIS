import { getMediaListStatusText } from "./status"
import type {
  BorealisActor,
  BorealisBadge,
  BorealisEntityType,
  BorealisHoverDetails,
  BorealisNormalizedData,
  BorealisProgressInfo,
} from "./types"

function getConnectedCount(connections: unknown): number {
  if (!connections) return 0
  if (Array.isArray(connections)) {
    return connections.filter(Boolean).length
  }
  if (typeof connections === "object") {
    return Object.keys(connections as Record<string, unknown>).filter((key) => {
      const val = (connections as Record<string, unknown>)[key]
      if (!val) return false
      if (typeof val === "object") {
        return Object.keys(val).length > 0
      }
      return true
    }).length
  }
  return 0
}

function formatAirDate(dateVal: unknown): string | null {
  if (!dateVal) return null
  if (typeof dateVal === "string" && !/^\d{4}-\d{2}/.test(dateVal)) {
    return dateVal
  }
  const d = new Date(dateVal as string | number | Date)
  if (isNaN(d.getTime())) return typeof dateVal === "string" ? dateVal : null
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function resolveMediaTitle(
  media: any,
  pref: "primary" | "secondary" | "native" = "primary"
): { title: string; titleSecondary?: string | null; titleNative?: string | null } {
  const primary =
    media.titlePrimary ||
    media.titleEnglish ||
    media.titleRomaji ||
    media.title ||
    media.name ||
    "Untitled"
  const secondary = media.titleSecondary || media.titleEnglish || media.titleRomaji || null
  const native = media.titleNative || null

  if (pref === "secondary" && secondary) {
    return { title: secondary, titleSecondary: primary !== secondary ? primary : null, titleNative: native }
  }
  if (pref === "native" && native) {
    return { title: native, titleSecondary: primary !== native ? primary : null, titleNative: native }
  }
  return { title: primary, titleSecondary: secondary, titleNative: native }
}

export function computeTvProgress(raw: any, item: any): {
  seasonNumber: number
  episodeNumber: number
  seasonEpisodeCount?: number
} {
  const entry = raw?.entry ?? item?.entry ?? raw ?? item
  const media = raw?.media ?? item?.media ?? item
  const seasons: any[] = Array.isArray(media?.seasons) ? media.seasons : []
  const entrySeasons: any[] = Array.isArray(entry?.seasons) ? entry.seasons : []
  const watchedEpisodes: any[] = Array.isArray(entry?.watchedEpisodes)
    ? entry.watchedEpisodes
    : []

  // 1. From watchedEpisodes: find the highest season and episode watched
  if (watchedEpisodes.length > 0) {
    const sorted = [...watchedEpisodes].sort((a, b) => {
      if (b.seasonNumber !== a.seasonNumber)
        return b.seasonNumber - a.seasonNumber
      return b.episodeNumber - a.episodeNumber
    })
    const latest = sorted[0]
    const sObj = seasons.find((s) => s.seasonNumber === latest.seasonNumber)
    return {
      seasonNumber: latest.seasonNumber,
      episodeNumber: latest.episodeNumber,
      seasonEpisodeCount:
        sObj?.episodeCount && sObj.episodeCount > 0
          ? sObj.episodeCount
          : undefined,
    }
  }

  // 2. From entrySeasons: find latest season with progress > 0
  if (entrySeasons.length > 0) {
    const activeSeasons = entrySeasons
      .filter((es: any) => es.progress > 0)
      .sort((a: any, b: any) => b.seasonNumber - a.seasonNumber)
    if (activeSeasons.length > 0) {
      const latest = activeSeasons[0]
      const sObj = seasons.find((s) => s.seasonNumber === latest.seasonNumber)
      return {
        seasonNumber: latest.seasonNumber,
        episodeNumber: latest.progress,
        seasonEpisodeCount:
          sObj?.episodeCount && sObj.episodeCount > 0
            ? sObj.episodeCount
            : undefined,
      }
    }
  }

  // 3. Fallback: cumulative episodes calculated across seasons
  const overallProg = Number(entry?.progress ?? item?.progress ?? 0)
  if (seasons.length > 0) {
    const regularSeasons = seasons
      .filter((s: any) => s.seasonNumber > 0)
      .sort((a: any, b: any) => a.seasonNumber - b.seasonNumber)
    const list =
      regularSeasons.length > 0
        ? regularSeasons
        : [...seasons].sort((a: any, b: any) => a.seasonNumber - b.seasonNumber)

    if (overallProg <= 0) {
      const first = list.find((s: any) => (s.episodeCount || 0) > 0) ?? list[0]
      return {
        seasonNumber: first?.seasonNumber ?? 1,
        episodeNumber: 0,
        seasonEpisodeCount:
          first?.episodeCount && first.episodeCount > 0
            ? first.episodeCount
            : undefined,
      }
    }

    let remaining = overallProg
    let lastValidSeason: any = null

    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      const count = s.episodeCount || 0

      if (count > 0) {
        lastValidSeason = s
      }

      if (count <= 0 && remaining > 0 && lastValidSeason) {
        return {
          seasonNumber: lastValidSeason.seasonNumber,
          episodeNumber: lastValidSeason.episodeCount || remaining,
          seasonEpisodeCount:
            lastValidSeason.episodeCount > 0
              ? lastValidSeason.episodeCount
              : undefined,
        }
      }

      if (remaining <= count) {
        return {
          seasonNumber: s.seasonNumber,
          episodeNumber: remaining,
          seasonEpisodeCount: count > 0 ? count : undefined,
        }
      }

      if (count > 0) {
        remaining -= count
      }
    }

    if (lastValidSeason) {
      return {
        seasonNumber: lastValidSeason.seasonNumber,
        episodeNumber: lastValidSeason.episodeCount || remaining,
        seasonEpisodeCount:
          lastValidSeason.episodeCount > 0
            ? lastValidSeason.episodeCount
            : undefined,
      }
    }
  }

  return {
    seasonNumber: 1,
    episodeNumber: overallProg,
    seasonEpisodeCount:
      typeof media?.episodeCount === "number" && media.episodeCount > 0
        ? media.episodeCount
        : undefined,
  }
}

function extractProgress(type: BorealisEntityType, item: any, raw: any): BorealisProgressInfo | null {
  const entry = raw?.entry ?? item?.entry ?? (raw?.progress !== undefined || raw?.status !== undefined ? raw : null)
  if (!entry && item?.progress === undefined && item?.currentProgress === undefined) {
    return null
  }

  const isManga = type === "manga"
  const isBook = type === "books" || type === "book"
  const isAnime = type === "anime"
  const isTv = type === "tv"

  if (isManga || isBook) {
    const chapterCurrent = Number(
      entry?.chaptersProgress ??
      entry?.progressChapters ??
      entry?.progress ??
      item.chaptersProgress ??
      item.progress ??
      0
    )
    const rawChMax = Number(
      item.chapterCount ??
      item.chapters ??
      raw.media?.chapterCount ??
      raw.media?.chapters
    )
    const chapterMax = !isNaN(rawChMax) && rawChMax > 0 ? rawChMax : null

    const volumeCurrent = Number(
      entry?.volumesProgress ??
      entry?.progressVolumes ??
      item.volumesProgress ??
      0
    )
    const rawVolMax = Number(
      item.volumeCount ??
      item.volumes ??
      raw.media?.volumeCount ??
      raw.media?.volumes
    )
    const volumeMax = !isNaN(rawVolMax) && rawVolMax > 0 ? rawVolMax : null

    return {
      current: isNaN(chapterCurrent) ? 0 : chapterCurrent,
      max: chapterMax,
      unit: "Ch",
      chapterCurrent: isNaN(chapterCurrent) ? 0 : chapterCurrent,
      chapterMax,
      volumeCurrent: isNaN(volumeCurrent) ? 0 : volumeCurrent,
      volumeMax,
    }
  }

  const current = Number(entry?.progress ?? item.progress ?? item.currentProgress ?? 0)
  let max: number | null = null
  let unit = "Ep"

  if (isAnime) {
    unit = "Ep"
    const eps = item.episodeCount ?? item.episodesCount ?? raw.media?.episodeCount ?? raw.media?.episodesCount
    const m = typeof eps === "number" ? eps : Array.isArray(eps) ? eps.length : null
    if (m && m > 0) max = m
    return {
      current: isNaN(current) ? 0 : current,
      max,
      unit,
    }
  }

  if (isTv) {
    unit = "Ep"
    const tvProg = computeTvProgress(raw, item)
    const eps = item.episodeCount ?? raw.media?.episodeCount
    const m = typeof eps === "number" ? eps : Array.isArray(eps) ? eps.length : null
    if (m && m > 0) max = m
    return {
      current: isNaN(current) ? 0 : current,
      max,
      unit: "Ep",
      seasonNumber: tvProg.seasonNumber,
      episodeNumber: tvProg.episodeNumber,
      seasonEpisodeCount: tvProg.seasonEpisodeCount ?? null,
    }
  }

  if (type === "movies" || type === "movie") {
    unit = "Movie"
  } else if (type === "games" || type === "game") {
    unit = "Hours"
  } else if (type === "music") {
    unit = "Plays"
  } else {
    unit = "Hours"
  }

  return {
    current: isNaN(current) ? 0 : current,
    max,
    unit,
  }
}

function cleanDescription(text?: string | null): string {
  if (!text) return ""
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function formatScore(score?: number | null): string | null {
  if (score === null || score === undefined || isNaN(score) || score <= 0) return null
  const normalized = score > 10 ? score / 10 : score
  return normalized.toFixed(1)
}

function resolveDetailHref(type: BorealisEntityType, id: number | string): string {
  switch (type) {
    case "anime":
      return `/borealis/anime/${id}`
    case "manga":
      return `/borealis/manga/${id}`
    case "movies":
    case "movie":
      return `/borealis/movies/${id}`
    case "tv":
      return `/borealis/tv/${id}`
    case "books":
    case "book":
      return `/borealis/books/${id}`
    case "games":
    case "game":
      return `/borealis/games/${id}`
    case "music":
      return `/borealis/music/tracks/${id}`
    case "character":
    case "characters":
      return `/borealis/characters/${id}`
    case "staff":
    case "people":
      return `/borealis/people/${id}`
    case "studio":
    case "studios":
      return `/borealis/studios/${id}`
    case "episode":
    case "episodes":
      return "#"
    default:
      return `/borealis/${type}/${id}`
  }
}

export function groupMediaCharacters(
  rawCharacters: any[] = [],
  preferredLanguage: string = "Japanese"
) {
  const map = new Map<number, any>()
  for (const item of rawCharacters) {
    const charId = item.characterId ?? item.character?.id ?? item.id
    if (!charId) continue
    let existing = map.get(charId)
    if (!existing) {
      existing = {
        id: charId,
        characterId: charId,
        character: item.character ?? item,
        role: item.role ?? "MAIN",
        order: item.order,
        actor: item.actor,
        actors: item.actor ? [item.actor] : [],
      }
      map.set(charId, existing)
    } else {
      if (item.actor) {
        existing.actors.push(item.actor)
        if (item.actor.language === preferredLanguage) {
          existing.actor = item.actor
        }
      }
    }
  }

  const list = Array.from(map.values())
  // Prioritize MAIN characters, then SUPPORTING, then by order
  list.sort((a, b) => {
    const roleRank = (role: string) =>
      role?.toUpperCase() === "MAIN" ? 1 : role?.toUpperCase() === "SUPPORTING" ? 2 : 3
    const rankDiff = roleRank(a.role) - roleRank(b.role)
    if (rankDiff !== 0) return rankDiff
    return (a.order ?? 999) - (b.order ?? 999)
  })
  return list
}

export function normalizeBorealisData(
  type: BorealisEntityType,
  raw: any,
  hrefOverride?: string,
  options?: { titlePreference?: "primary" | "secondary" | "native" }
): BorealisNormalizedData {
  if (!raw) {
    return {
      id: 0,
      type,
      href: "#",
      title: "Unknown",
      aspectRatio: "poster",
      badges: [],
      hoverDetails: {},
      raw: {},
    }
  }

  // Handle potential nested wrapper: { media: { ... }, entry: { ... } }
  const item = raw.media ? { ...raw.media, ...raw } : raw
  const connectedCount = getConnectedCount(raw?.entry?.connections ?? item?.connections)
  const progress = extractProgress(type, item, raw)
  const pref = options?.titlePreference ?? "primary"
  const isQueued = Boolean(raw?.queuedForFetch ?? item?.queuedForFetch)

    if (type === "character" || (type as string) === "characters") {
      const character = item.character ?? item
      const charId = character.id ?? item.characterId ?? item.id ?? 0
      const namePrimary = character.namePrimary ?? item.namePrimary ?? "Unknown Character"
      const nameNative = character.nameNative ?? item.nameNative ?? null
      const charTitle = pref === "native" && nameNative ? nameNative : namePrimary
      const charTitleNative =
        pref === "native" && nameNative
          ? (namePrimary !== nameNative ? namePrimary : null)
          : nameNative
      const image = character.image ?? item.image ?? null
      const roleRaw = String(item.role ?? character.role ?? "MAIN").toUpperCase()

      let roleBadgeVariant: BorealisBadge["variant"] = "secondary"
      let roleLabel = roleRaw
      let roleBadgeClass = ""
      if (roleRaw === "MAIN") {
        roleBadgeVariant = "default"
        roleLabel = "MAIN"
        roleBadgeClass =
          "bg-frost border border-white/40 text-white font-mono text-[10px] font-black tracking-wider uppercase shadow-md backdrop-blur-md"
      } else if (roleRaw === "SUPPORTING") {
        roleBadgeVariant = "secondary"
        roleLabel = "SUPPORTING"
        roleBadgeClass =
          "bg-frost border border-frost text-zinc-200 font-mono text-[10px] font-bold tracking-wider uppercase shadow-md backdrop-blur-md"
      } else if (roleRaw === "BACKGROUND") {
        roleBadgeVariant = "outline"
        roleLabel = "BACKGROUND"
        roleBadgeClass =
          "bg-frost border border-frost text-zinc-400 font-mono text-[10px] font-medium tracking-wider uppercase shadow-md backdrop-blur-md"
      }

      const badges: BorealisBadge[] = [
        {
          label: roleLabel,
          variant: roleBadgeVariant,
          className: roleBadgeClass,
        },
      ]

      if (isQueued) {
        badges.push({
          label: "Queued",
          variant: "secondary",
          className:
            "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-md",
        })
      }

      const actorRaw =
        item.actor ??
        (Array.isArray(item.actors)
          ? item.actors.find((a: any) => a?.language === "Japanese") ?? item.actors[0]
          : null)
      const actor: BorealisActor | null = actorRaw
        ? {
          id: actorRaw.id,
          namePrimary: actorRaw.namePrimary,
          nameNative: actorRaw.nameNative ?? null,
          image: actorRaw.image ?? null,
          language: actorRaw.language ?? null,
        }
        : null

      const dobParts = [
        character.dateOfBirthMonth ? `${character.dateOfBirthMonth}` : null,
        character.dateOfBirthDay ? `${character.dateOfBirthDay}` : null,
      ].filter(Boolean)

      const hoverDetails: BorealisHoverDetails = {
        bannerImage: character.bannerImage ?? item.bannerImage ?? null,
        description: cleanDescription(character.description ?? item.description ?? raw?.description),
        gender: character.gender ?? item.gender ?? raw?.gender ?? null,
        age: character.age ? String(character.age) : item.age ? String(item.age) : raw?.age ? String(raw.age) : null,
        dateOfBirth: dobParts.length > 0 ? dobParts.join("/") : null,
        actor,
        roles: [roleLabel],
        isQueued,
        extraStats: [
          ...(character.gender || item.gender ? [{ label: "Gender", value: character.gender ?? item.gender }] : []),
          ...(character.age || item.age ? [{ label: "Age", value: String(character.age ?? item.age) }] : []),
          ...(character.favorites ? [{ label: "Favorites", value: Number(character.favorites).toLocaleString() }] : []),
        ],
      }

      const defaultHref = resolveDetailHref("character", charId)
      const finalHref = hrefOverride ?? (isQueued ? `${defaultHref}?queuedFetch=true` : defaultHref)

      return {
        id: charId,
        type: "character",
        href: finalHref,
        title: charTitle,
        titleNative: charTitleNative,
        description: cleanDescription(character.description ?? item.description),
        image,
        aspectRatio: "poster",
        badges,
        actor,
        hoverDetails,
        raw,
      }
    }

      if (type === "staff" || (type as string) === "people") {
        const person = item.person ?? item
        const personId = person.id ?? item.personId ?? item.id ?? 0
        const namePrimary = person.namePrimary ?? item.namePrimary ?? "Unknown Person"
        const nameNative = person.nameNative ?? item.nameNative ?? null
        const staffTitle = pref === "native" && nameNative ? nameNative : namePrimary
        const staffTitleNative =
          pref === "native" && nameNative
            ? (namePrimary !== nameNative ? namePrimary : null)
            : nameNative
        const image = person.image ?? item.image ?? null
        const role = item.customRole ?? item.role ?? (Array.isArray(person.primaryOccupations) ? person.primaryOccupations[0] : null) ?? "Staff"

        const badges: BorealisBadge[] = role
          ? [
            {
              label: String(role).replace(/_/g, " "),
              variant: "secondary",
              className:
                "bg-frost border border-frost text-zinc-100 font-mono text-[10px] font-bold tracking-wider uppercase shadow-md backdrop-blur-md",
            },
          ]
          : []

        if (isQueued) {
          badges.push({
            label: "Queued",
            variant: "secondary",
            className:
              "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-md",
          })
        }

        const hoverDetails: BorealisHoverDetails = {
          bannerImage: person.bannerImage ?? item.bannerImage ?? null,
          description: cleanDescription(person.description ?? item.description ?? raw?.description),
          primaryOccupations: Array.isArray(person.primaryOccupations) ? person.primaryOccupations : [],
          gender: person.gender ?? item.gender ?? raw?.gender ?? null,
          age: person.age ? String(person.age) : item.age ? String(item.age) : raw?.age ? String(raw.age) : null,
          roles: [role],
          isQueued,
          extraStats: [
            ...(person.language ? [{ label: "Language", value: person.language }] : []),
            ...(person.homeTown ? [{ label: "Hometown", value: person.homeTown }] : []),
            ...(person.birthPlace ? [{ label: "Birthplace", value: person.birthPlace }] : []),
            ...(person.favorites ? [{ label: "Favorites", value: Number(person.favorites).toLocaleString() }] : []),
          ],
        }

        const defaultHref = resolveDetailHref("staff", personId)
        const finalHref = hrefOverride ?? (isQueued ? `${defaultHref}?queuedFetch=true` : defaultHref)

        return {
          id: personId,
          type: "staff",
          href: finalHref,
          title: staffTitle,
          titleNative: staffTitleNative,
          description: cleanDescription(person.description ?? item.description),
          image,
          aspectRatio: "poster",
          badges,
          subtext: role,
          hoverDetails,
          raw,
        }
      }

        if (type === "studio" || (type as string) === "studios") {
          const studio = item.studio ?? item
          const studioId = studio.id ?? item.studioId ?? item.id ?? 0
          const name = studio.name ?? "Unknown Studio"
          const isAnim = studio.isAnimationStudio ?? false

          const badges: BorealisBadge[] = [
            {
              label: isAnim ? "Animation Studio" : "Producer",
              variant: isAnim ? "default" : "outline",
            },
          ]

          if (isQueued) {
            badges.push({
              label: "Queued",
              variant: "secondary",
              className:
                "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-md",
            })
          }

          const defaultHref = resolveDetailHref("studio", studioId)
          const finalHref = hrefOverride ?? (isQueued ? `${defaultHref}?queuedFetch=true` : defaultHref)

          return {
            id: studioId,
            type: "studio",
            href: finalHref,
            title: name,
            description: cleanDescription(studio.description),
            aspectRatio: "poster",
            badges,
            hoverDetails: {
              description: cleanDescription(studio.description),
              isQueued,
              extraStats: [
                ...(studio.favorites ? [{ label: "Favorites", value: Number(studio.favorites).toLocaleString() }] : []),
              ],
            },
            raw,
          }
        }

        // Episode items
        if (type === "episode" || (type as string) === "episodes") {
          const epId = item.id ?? item.number ?? 0
          const epNum = item.number ?? item.episodeNumber
          const epTitle = item.titlePrimary || item.title || (epNum ? `Episode ${epNum}` : "Episode")
          const epTitleSecondary = item.titleSecondary ?? null
          const epTitleNative = item.titleNative ?? null
          const image = item.thumbnail ?? item.image ?? item.coverImage ?? null
          const airDateFormatted = formatAirDate(item.airDate ?? item.airingAt)

          const badges: BorealisBadge[] = Array.isArray(item.badges) ? [...item.badges] : []
          if (badges.length === 0 && epNum !== undefined) {
            badges.push({
              label: item.seasonNumber !== undefined && item.seasonNumber !== null && item.seasonNumber > 0
                ? `S${item.seasonNumber} · E${epNum}`
                : `EP ${epNum}`,
              variant: "secondary",
              className: "bg-frost border border-frost text-zinc-100 font-mono text-[10px] font-bold tracking-wider shadow-md backdrop-blur-md",
            })
            if (item.isFiller) {
              badges.push({
                label: "Filler",
                variant: "outline",
                className: "border-amber-500/50 bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold backdrop-blur-md",
              })
            }
            if (item.isRecap) {
              badges.push({
                label: "Recap",
                variant: "outline",
                className: "border-blue-500/50 bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold backdrop-blur-md",
              })
            }
          }

          const hoverDetails: BorealisHoverDetails = {
            bannerImage: item.bannerImage ?? image,
            coverImage: image,
            description: cleanDescription(item.description),
            airDate: airDateFormatted ?? (item.airDate ? String(item.airDate) : null),
            year: airDateFormatted ?? (item.airDate ? String(item.airDate) : null),
            duration: item.duration ?? null,
            format: epNum ? (item.seasonNumber ? `S${item.seasonNumber} · E${epNum}` : `EP ${epNum}`) : null,
            ...(item.hoverDetails || {}),
          }

          return {
            id: epId,
            type: "episode",
            href: hrefOverride ?? item.href ?? "#",
            title: epTitle,
            titleNative: epTitleNative,
            titleSecondary: epTitleSecondary,
            description: cleanDescription(item.description),
            image,
            aspectRatio: "video",
            badges,
            hoverDetails,
            raw,
          }
        }

        // Media types (anime, manga, movies, tv, books, games, music, other)
        const id = item.id ?? 0
        const resolved = resolveMediaTitle(item, pref)
        const title = resolved.title
        const titleNative = resolved.titleNative
        const titleSecondary = resolved.titleSecondary
        const image = item.coverImage ?? item.image ?? item.posterImage ?? raw?.coverImage ?? raw?.image ?? raw?.posterImage ?? null
        const bannerImage = item.bannerImage ?? raw?.bannerImage ?? raw?.media?.bannerImage ?? null
        const description = cleanDescription(item.description ?? raw?.description ?? raw?.media?.description)

        const isMusic = type === "music"
        const aspectRatio = isMusic ? "square" : "poster"

        const rawScore = item.averageScore ?? item.alAverageScore ?? item.malAverageScore ?? item.score ?? null
        const scoreFormatted = formatScore(rawScore)

        const formatStr = typeof item.format === "string" ? item.format.replace(/_/g, " ") : null
        const statusStr = typeof item.status === "string" ? item.status.replace(/_/g, " ") : null

        const badges: BorealisBadge[] = []
        if (formatStr) {
          badges.push({
            label: formatStr,
            variant: "secondary",
            className:
              "bg-frost border border-frost text-zinc-100 font-mono text-[10px] font-bold tracking-wider uppercase shadow-md backdrop-blur-md",
          })
        }

        if (isQueued) {
          badges.push({
            label: "Queued",
            variant: "secondary",
            className:
              "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-md",
          })
        }

        const seasonYear = item.seasonYear ?? item.startDateYear ?? item.releaseYear ?? item.year ?? null
        const season = item.seasonSeason ?? item.season ?? null
        const yearOrSeason = season && seasonYear ? `${String(season).slice(0, 3)} ${seasonYear}` : seasonYear ? String(seasonYear) : null

        const metaPills: string[] = []
        if (yearOrSeason) metaPills.push(yearOrSeason)
        if (item.episodeCount && Number(item.episodeCount) > 0) metaPills.push(`${item.episodeCount} eps`)
        if (item.chapterCount && Number(item.chapterCount) > 0) metaPills.push(`${item.chapterCount} chs`)
        if (item.volumeCount && Number(item.volumeCount) > 0) metaPills.push(`${item.volumeCount} vols`)

        const rawGenres = Array.isArray(item.genres) ? item.genres : Array.isArray(raw?.genres) ? raw.genres : Array.isArray(raw?.media?.genres) ? raw.media.genres : []
        const genres: string[] = rawGenres
          .map((g: any) => (typeof g === "string" ? g : g?.name || g?.genre?.name || ""))
          .filter(Boolean)

        if (genres.length > 0) {
          metaPills.push(genres.slice(0, 2).join(", "))
        }

        const rawStudios = Array.isArray(item.studios) ? item.studios : Array.isArray(raw?.studios) ? raw.studios : Array.isArray(raw?.media?.studios) ? raw.media.studios : []
        const studios: string[] = rawStudios
          .map((s: any) => (typeof s === "string" ? s : s?.studio?.name || s?.name || ""))
          .filter(Boolean)

        const rawListStatus = raw?.entry?.status ?? item?.entry?.status ?? item.listStatus ?? item.userStatus ?? item.listEntry?.status ?? null
        const listStatusStr = typeof rawListStatus === "string" ? rawListStatus.toUpperCase() : null
        const listStatusText = listStatusStr
          ? getMediaListStatusText(listStatusStr, type)
          : null

        const rawPriority = raw?.entry?.priority ?? item?.entry?.priority ?? item.priority ?? item.listPriority ?? item.listEntry?.priority ?? "LOW"
        const priorityStr = typeof rawPriority === "string" ? rawPriority.toUpperCase() : "LOW"

        const hoverDetails: BorealisHoverDetails = {
          bannerImage,
          description,
          score: rawScore,
          scoreFormatted,
          status: statusStr,
          listStatus: listStatusStr,
          listStatusText,
          format: formatStr,
          year: seasonYear,
          season: season ? String(season) : null,
          episodeCount: item.episodeCount && Number(item.episodeCount) > 0 ? Number(item.episodeCount) : null,
          chapterCount: item.chapterCount && Number(item.chapterCount) > 0 ? Number(item.chapterCount) : null,
          volumeCount: item.volumeCount && Number(item.volumeCount) > 0 ? Number(item.volumeCount) : null,
          studios,
          genres,
          isQueued,
          tags: Array.isArray(item.tags)
            ? item.tags.map((t: any) => (typeof t === "string" ? t : t?.name || t?.tag?.name || "")).filter(Boolean).slice(0, 8)
            : [],
          relations: Array.isArray(item.relations)
            ? item.relations
            : Array.isArray(raw?.media?.relations)
              ? raw.media.relations
              : undefined,
          extraStats: [
            ...(statusStr ? [{ label: "Status", value: statusStr }] : []),
            ...(yearOrSeason ? [{ label: "Release", value: yearOrSeason }] : []),
            ...(studios.length > 0 ? [{ label: "Studio", value: studios[0] }] : []),
            ...(item.source ? [{ label: "Source", value: String(item.source).replace(/_/g, " ") }] : []),
            ...(item.popularity ? [{ label: "Popularity", value: Number(item.popularity).toLocaleString() }] : []),
            ...(item.favorites ? [{ label: "Favorites", value: Number(item.favorites).toLocaleString() }] : []),
          ],
        }

        const defaultHref = resolveDetailHref(type, id)
        const finalHref = hrefOverride ?? (isQueued ? `${defaultHref}?queuedFetch=true` : defaultHref)

        return {
          id,
          type,
          href: finalHref,
          title,
          titleNative,
          titleSecondary,
          description,
          image,
          aspectRatio,
          badges,
          subtext: studios[0] ?? (isMusic ? item.artistName ?? item.artist : null) ?? null,
          metaPills,
          progress,
          connectedCount,
          listStatus: listStatusStr,
          priority: priorityStr,
          hoverDetails,
          raw,
        }
      }
