import { Prisma, type PrismaClient } from "@IRIS/database"

export type MediaSearchTable =
  "Anime" | "Manga" | "Movie" | "Tv" | "Game" | "Book"

export type EntitySearchTable = MediaSearchTable | "Character" | "Person"

/**
 * Escapes PostgreSQL LIKE / ILIKE special characters (% and _ and \)
 */
export function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, "\\$&")
}

/**
 * Returns IDs of media entries where any synonym matches the query case-insensitively.
 * In PostgreSQL, scalar string arrays (text[]) do not support case-insensitive filtering
 * via Prisma's findMany `where`, so we query matching IDs via unnest + ILIKE.
 */
export async function findMatchingSynonymIds(
  prisma: PrismaClient,
  table: MediaSearchTable,
  query: string,
  limit: number = 50
): Promise<number[]> {
  return findMatchingArrayElementIds(prisma, table, "synonyms", query, limit)
}

/**
 * Returns IDs of character or person entries where any alternative name matches
 * the query case-insensitively.
 */
export async function findMatchingAlternativeNameIds(
  prisma: PrismaClient,
  table: "Character" | "Person",
  query: string,
  limit: number = 50
): Promise<number[]> {
  return findMatchingArrayElementIds(
    prisma,
    table,
    "nameAlternative",
    query,
    limit
  )
}

/**
 * Returns IDs of records where any element in a string array column (e.g. synonyms, nameAlternative)
 * matches the query case-insensitively using PostgreSQL ILIKE.
 */
export async function findMatchingArrayElementIds(
  prisma: PrismaClient,
  table: EntitySearchTable,
  column: "synonyms" | "nameAlternative",
  query: string,
  limit: number = 50
): Promise<number[]> {
  const clean = query.trim()
  if (!clean) return []

  const escaped = escapeLikePattern(clean)
  const pattern = `%${escaped}%`

  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM ${Prisma.raw(`"${table}"`)}
    WHERE EXISTS (
      SELECT 1 FROM unnest(${Prisma.raw(`"${column}"`)}) AS s
      WHERE s ILIKE ${pattern}
    )
    LIMIT ${limit};
  `

  return rows.map((r) => r.id)
}
