import type { NormalizedMediaData } from "./media-types"

const DEFAULT_FORMAT: Record<string, string> = {
  tv: "TV",
  movies: "MOVIE",
  games: "GAME",
  books: "BOOK",
}

/**
 * Maps the slim overview payload of /borealis/<type>/:id to NormalizedMediaData.
 * Heavy sections (characters list, staff, episodes, relations, images, stats)
 * are NOT part of the overview; each tab loads them from its own endpoint.
 */
export function toNormalizedMediaOverview(
  category: NormalizedMediaData["category"],
  raw: any
): NormalizedMediaData {
  const r = raw ?? {}
  const studios = (r.studios ?? []).map((s: any) =>
    s.studio
      ? s
      : { id: s.id, isMain: Boolean(s.isMain), studio: { id: s.id, name: s.name, isAnimationStudio: s.isAnimationStudio } }
  )

  let externalLinks: Array<{ url: string; site?: string; type?: string }> | null = null
  if (Array.isArray(r.externalLinks)) {
    externalLinks = r.externalLinks
  } else if (r.externalLinks && typeof r.externalLinks === "object") {
    const entries: Array<{ url: string; site?: string; type?: string }> = []
    for (const [key, val] of Object.entries(r.externalLinks)) {
      if (typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"))) {
        const label =
          key === "previewLink"
            ? "Preview"
            : key === "infoLink"
              ? "Info"
              : key === "buyLink"
                ? "Buy"
                : key === "siteUrl" || key === "website"
                  ? "Official Site"
                  : key.charAt(0).toUpperCase() + key.slice(1)
        entries.push({ url: val, site: label })
      } else if (val && typeof val === "object" && "url" in val && typeof (val as any).url === "string") {
        entries.push({
          url: (val as any).url,
          site: (val as any).site || (val as any).name || key.charAt(0).toUpperCase() + key.slice(1),
          type: (val as any).type,
        })
      }
    }
    externalLinks = entries.length > 0 ? entries : null
  }

  return {
    ...r,
    category,
    titleSecondary: r.titleSecondary ?? r.subtitle ?? null,
    titleNative: r.titleNative ?? null,
    coverImage: r.coverImage ?? null,
    bannerImage: r.bannerImage ?? r.backgroundImage ?? null,
    description: r.description ?? null,
    format: r.format ?? DEFAULT_FORMAT[category] ?? null,
    status: r.status ?? null,
    startDateYear:
      r.startDateYear ?? r.releaseDateYear ?? r.firstAiredYear ?? null,
    episodeCount: r.episodeCount ?? r.chapterCount ?? null,
    isAdult: Boolean(r.isAdult),
    genres: r.genres ?? [],
    tags: r.tags ?? [],
    studios,
    externalLinks,
    sources: r.sources ?? null,
    characters: r.characters ?? [],
    staff: [],
    relations: [],
    updatedAt: r.updatedAt,
  } as NormalizedMediaData
}

