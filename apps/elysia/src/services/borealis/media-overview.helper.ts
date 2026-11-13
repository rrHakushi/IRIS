import { prisma, and, type MediaType } from '@NamelessLiberty/db'

/** Top 16 characters for a media overview (MAIN first). */
export async function fetchTopCharacters(mediaType: string, id: number, limit = 16) {
  // media_character has one row per (character, voice actor), so rows != characters.
  // Collect DISTINCT characters: MAIN first, then fill remaining slots with the rest.
  const BATCH = 100
  const seen = new Set<number>()
  const result: any[] = []

  const collect = async (main: boolean) => {
    for (let offset = 0; result.length < limit; offset += BATCH) {
      const rows = await prisma.orm.public.MediaCharacter
        .where((mc) =>
          and(
            mc.mediaType.eq(mediaType as MediaType),
            mc.mediaId.eq(id),
            main ? mc.role.eq('MAIN' as any) : mc.role.neq('MAIN' as any)
          )
        )
        .orderBy((mc) => mc.id.asc())
        .include('character')
        .include('actor')
        .offset(offset)
        .limit(BATCH)
        .all()

      for (const c of rows as any[]) {
        if (!c.character || seen.has(c.characterId)) continue
        seen.add(c.characterId)
        result.push(c)
        if (result.length >= limit) break
      }
      if (rows.length < BATCH) break
    }
  }

  await collect(true)
  if (result.length < limit) await collect(false)

  return result.map((c: any) => ({
    id: c.id,
    mediaId: c.mediaId,
    mediaType: c.mediaType,
    characterId: c.characterId,
    actorId: c.actorId ?? null,
    role: c.role,
    characterData: {
      id: c.character.id,
      namePrimary: c.character.namePrimary,
      nameNative: c.character.nameNative ?? null,
      age: c.character.age ?? null,
      gender: c.character.gender ?? null,
      dateOfBirthDay: c.character.dateOfBirthDay ?? null,
      dateOfBirthMonth: c.character.dateOfBirthMonth ?? null,
      dateOfBirthYear: c.character.dateOfBirthYear ?? null,
      description: c.character.description ?? null,
      image: c.character.image ?? null,
    },
    actorData: c.actor
      ? {
          id: c.actor.id,
          namePrimary: c.actor.namePrimary,
          nameNative: c.actor.nameNative ?? null,
          language: c.actor.language ?? null,
          image: c.actor.image ?? null,
          description: c.actor.description ?? null,
        }
      : null,
  }))
}

/** Pick listed keys from a record, defaulting missing values to null. */
export function pick(src: any, keys: string[]) {
  const out: Record<string, any> = {}
  for (const k of keys) out[k] = src?.[k] ?? null
  return out
}

function unwrap(v: any): any[] {
  return Array.isArray(v) ? v : v ? [v] : []
}

export function flattenGenres(rows: any[] | undefined) {
  return (rows || []).flatMap((g: any) => unwrap(g.genre)).map((ge: any) => ({ id: ge.id, name: ge.name }))
}

export function flattenTags(rows: any[] | undefined) {
  return (rows || []).flatMap((t: any) => unwrap(t.tag)).map((te: any) => ({ id: te.id, name: te.name }))
}

/** Normalised similar/catalog item (spec fields only). */
export function similarItem(c: any, year: unknown, format: unknown) {
  return {
    id: c.id,
    titlePrimary: c.titlePrimary,
    titleSecondary: c.titleSecondary ?? null,
    titleNative: c.titleNative ?? null,
    coverImage: c.coverImage ?? null,
    bannerImage: c.bannerImage ?? null,
    averageScore: c.averageScore ?? null,
    format: format ? String(format) : null,
    status: c.status ? String(c.status) : null,
    startDateYear: year ?? null,
    description: c.description ?? null,
    genres: c.genres,
    tags: c.tags,
  }
}

/** Read a key out of a Jsonb `images` blob (object keyed by provider). */
export function imageSource(images: any, key: string) {
  if (!images || typeof images !== 'object') return null
  return images[key] ?? null
}
