import React from "react"
import type { Metadata } from "next"
import {
  BorealisCard,
  BorealisCardGroup,
  groupMediaCharacters,
} from "@Runa/borealis"
import { elysia } from "@/lib/elysia"

export const metadata: Metadata = {
  title: "Borealis Cards | Runa",
}

async function fetchShowcaseData() {
  try {
    const [animeRes, mangaRes, moviesRes, tvRes, gamesRes, booksRes] =
      await Promise.all([
        elysia.borealis.anime({ animeId: 15 }).get(),
        elysia.borealis.manga({ mangaId: 9 }).get(),
        elysia.borealis.movies({ movieId: 97 }).get(),
        elysia.borealis.tv({ tvId: 14 }).get(),
        elysia.borealis.games({ gameId: 2 }).get(),
        elysia.borealis.books({ bookId: 2 }).get(),
      ])

    const extract = (res: any) =>
      (res?.data as any)?.media ?? res?.data ?? null

    return {
      anime: extract(animeRes),
      manga: extract(mangaRes),
      movies: extract(moviesRes),
      tv: extract(tvRes),
      games: extract(gamesRes),
      books: extract(booksRes),
    }
  } catch (error) {
    console.error("Failed to fetch showcase media from Elysia API:", error)
    return {
      anime: null,
      manga: null,
      movies: null,
      tv: null,
      games: null,
      books: null,
    }
  }
}

export default async function RunaShowcasePage() {
  const { anime, manga, movies, tv, games, books } = await fetchShowcaseData()

  // All characters from Manga 9 (all 62 characters)
  const allMangaCharacters = manga?.characters
    ? groupMediaCharacters(manga.characters)
    : []

  const mangaStaff = (manga?.staff ?? []).slice(0, 12)

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        {/* Media Cards */}
        <div className="flex flex-wrap gap-5">
          {anime && <BorealisCard type="anime" data={anime} size="md" />}
          {manga && <BorealisCard type="manga" data={manga} size="md" />}
          {movies && <BorealisCard type="movies" data={movies} size="md" />}
          {tv && <BorealisCard type="tv" data={tv} size="md" />}
          {games && <BorealisCard type="games" data={games} size="md" />}
          {books && <BorealisCard type="books" data={books} size="md" />}
        </div>

        {/* 1 Row Carousel with all 62 characters */}
        {allMangaCharacters.length > 0 && (
          <BorealisCardGroup
            title="All Characters (1 Row Carousel)"
            subtitle={`${allMangaCharacters.length} characters • Smooth horizontal drag, touch swipe, & wheel scroll`}
            rowCount={1}
            variant="card"
          >
            {allMangaCharacters.map((charItem: any, idx: number) => (
              <BorealisCard
                key={charItem.id ?? idx}
                type="character"
                data={charItem}
                size="md"
              />
            ))}
          </BorealisCardGroup>
        )}

        {/* 5 Columns Grid with all 62 characters (no scroll, 5 columns, N rows) */}
        {allMangaCharacters.length > 0 && (
          <BorealisCardGroup
            title="All Characters (5 Columns Grid)"
            subtitle={`${allMangaCharacters.length} characters • 5 columns and N rows (no scroll)`}
            columnCount={5}
            variant="card"
          >
            {allMangaCharacters.map((charItem: any, idx: number) => (
              <BorealisCard
                key={charItem.id ?? idx}
                type="character"
                data={charItem}
                size="md"
              />
            ))}
          </BorealisCardGroup>
        )}

        {/* 5 Rows Carousel with all 62 characters (multi-row horizontal scroll) */}
        {allMangaCharacters.length > 0 && (
          <BorealisCardGroup
            title="All Characters (5 Rows Carousel)"
            subtitle={`${allMangaCharacters.length} characters • 5 rows chunked with horizontal momentum glide`}
            rowCount={5}
            variant="card"
          >
            {allMangaCharacters.map((charItem: any, idx: number) => (
              <BorealisCard
                key={charItem.id ?? idx}
                type="character"
                data={charItem}
                size="md"
              />
            ))}
          </BorealisCardGroup>
        )}

        {/* Staff Members (1 Row, variant="none", title on end) */}
        {mangaStaff.length > 0 && (
          <BorealisCardGroup
            title="Production Staff"
            subtitle={`${mangaStaff.length} staff members • variant="none" with controls mirrored to start`}
            titlePosition="end"
            rowCount={1}
            variant="none"
          >
            {mangaStaff.map((staffMember: any, idx: number) => (
              <BorealisCard
                key={staffMember.id ?? idx}
                type="staff"
                data={staffMember}
                size="md"
              />
            ))}
          </BorealisCardGroup>
        )}
      </div>
    </div>
  )
}
