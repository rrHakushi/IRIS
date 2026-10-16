import { prisma, type FavoriteType } from '@IRIS/database'

function initScoreDistribution(): Record<string, number> {
  const dist: Record<string, number> = {}
  for (let i = 1; i <= 10; i++) {
    dist[String(i)] = 0
  }
  return dist
}

interface EntryItem {
  status: string
  score: number | null
}

function computeStats(entries: EntryItem[]) {
  const popularity = entries.length
  const statusDistribution: Record<string, number> = {}
  const scoreDistribution = initScoreDistribution()

  let scoredCount = 0
  let rawScoreSum = 0

  for (const item of entries) {
    const status = item.status || 'PLANNING'
    statusDistribution[status] = (statusDistribution[status] || 0) + 1

    if (item.score !== null && item.score !== undefined && item.score > 0) {
      // Normalize score to 10-point scale: if > 10 (e.g. 85), divide by 10
      let normalized = Number(item.score)
      if (normalized > 10) normalized = normalized / 10
      normalized = Math.min(10, Math.max(0, normalized))

      scoredCount++
      rawScoreSum += normalized

      const bucket = Math.min(10, Math.max(1, Math.round(normalized)))
      scoreDistribution[String(bucket)] = (scoreDistribution[String(bucket)] || 0) + 1
    }
  }

  const totalScoreSum = scoredCount > 0 ? Math.round(rawScoreSum) : null
  const averageScore = scoredCount > 0 ? Math.round((rawScoreSum / scoredCount) * 10) / 10 : null

  return {
    popularity,
    statusDistribution,
    scoreDistribution,
    scoredCount: scoredCount > 0 ? scoredCount : null,
    totalScoreSum,
    averageScore,
  }
}

async function main() {
  console.log('🔄 [1/4] Resetting media stats and favorites on all media records...')

  const resetData = {
    averageScore: null,
    favorites: 0,
    popularity: 0,
    totalScoreSum: null,
    scoredCount: null,
    statusDistribution: {},
    scoreDistribution: {},
  }

  const [animeCount, mangaCount, movieCount, tvCount, gameCount, bookCount] = await Promise.all([
    prisma.anime.updateMany({ data: resetData }),
    prisma.manga.updateMany({ data: resetData }),
    prisma.movie.updateMany({ data: resetData }),
    prisma.tv.updateMany({ data: resetData }),
    prisma.game.updateMany({ data: resetData }),
    prisma.book.updateMany({ data: resetData }),
  ])

  await Promise.all([
    prisma.music.updateMany({ data: { favorites: 0 } }),
    prisma.character.updateMany({ data: { favorites: 0 } }),
    prisma.person.updateMany({ data: { favorites: 0 } }),
    prisma.studio.updateMany({ data: { favorites: 0 } }),
  ])

  console.log(
    `✅ Reset completed for:\n` +
      `  • Anime: ${animeCount.count}\n` +
      `  • Manga: ${mangaCount.count}\n` +
      `  • Movie: ${movieCount.count}\n` +
      `  • TV: ${tvCount.count}\n` +
      `  • Game: ${gameCount.count}\n` +
      `  • Book: ${bookCount.count}`
  )

  console.log('\n💖 [2/4] Recalculating favorites from Favorite table...')
  const favoritesGrouped = await prisma.favorite.groupBy({
    by: ['type', 'targetId'],
    _count: { _all: true },
  })

  let favoritesUpdated = 0
  for (const group of favoritesGrouped) {
    const { type, targetId } = group
    const count = group._count._all

    try {
      switch (type) {
        case 'ANIME':
          await prisma.anime.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'MANGA':
          await prisma.manga.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'MOVIE':
          await prisma.movie.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'TV':
          await prisma.tv.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'GAME':
          await prisma.game.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'BOOK':
          await prisma.book.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'MUSIC_ALBUM':
        case 'MUSIC_TRACK':
          await prisma.music.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'CHARACTER':
          await prisma.character.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'PERSON':
          await prisma.person.update({ where: { id: targetId }, data: { favorites: count } })
          break
        case 'STUDIO':
          await prisma.studio.update({ where: { id: targetId }, data: { favorites: count } })
          break
      }
      favoritesUpdated++
    } catch {
      // Ignored if target record was deleted or does not exist
    }
  }
  console.log(`✅ Updated favorites count for ${favoritesUpdated} entities.`)

  console.log('\n📊 [3/4] Recalculating community stats from user lists...')

  // 1. Anime Lists
  const animeLists = await prisma.animeList.findMany({
    select: { animeId: true, status: true, score: true },
  })
  const animeMap = new Map<number, EntryItem[]>()
  for (const e of animeLists) {
    const list = animeMap.get(e.animeId) || []
    list.push({ status: e.status, score: e.score })
    animeMap.set(e.animeId, list)
  }
  for (const [id, entries] of animeMap.entries()) {
    const stats = computeStats(entries)
    await prisma.anime.update({ where: { id }, data: stats }).catch(() => {})
  }
  console.log(`  • Updated stats for ${animeMap.size} anime titles`)

  // 2. Manga Lists
  const mangaLists = await prisma.mangaList.findMany({
    select: { mangaId: true, status: true, score: true },
  })
  const mangaMap = new Map<number, EntryItem[]>()
  for (const e of mangaLists) {
    const list = mangaMap.get(e.mangaId) || []
    list.push({ status: e.status, score: e.score })
    mangaMap.set(e.mangaId, list)
  }
  for (const [id, entries] of mangaMap.entries()) {
    const stats = computeStats(entries)
    await prisma.manga.update({ where: { id }, data: stats }).catch(() => {})
  }
  console.log(`  • Updated stats for ${mangaMap.size} manga titles`)

  // 3. Movie Lists
  const movieLists = await prisma.movieList.findMany({
    select: { movieId: true, status: true, score: true },
  })
  const movieMap = new Map<number, EntryItem[]>()
  for (const e of movieLists) {
    const list = movieMap.get(e.movieId) || []
    list.push({ status: e.status, score: e.score })
    movieMap.set(e.movieId, list)
  }
  for (const [id, entries] of movieMap.entries()) {
    const stats = computeStats(entries)
    await prisma.movie.update({ where: { id }, data: stats }).catch(() => {})
  }
  console.log(`  • Updated stats for ${movieMap.size} movie titles`)

  // 4. TV Lists
  const tvLists = await prisma.tvList.findMany({
    select: { tvId: true, status: true, score: true },
  })
  const tvMap = new Map<number, EntryItem[]>()
  for (const e of tvLists) {
    const list = tvMap.get(e.tvId) || []
    list.push({ status: e.status, score: e.score })
    tvMap.set(e.tvId, list)
  }
  for (const [id, entries] of tvMap.entries()) {
    const stats = computeStats(entries)
    await prisma.tv.update({ where: { id }, data: stats }).catch(() => {})
  }
  console.log(`  • Updated stats for ${tvMap.size} TV series`)

  // 5. Game Lists
  const gameLists = await prisma.gameList.findMany({
    select: { gameId: true, status: true, score: true },
  })
  const gameMap = new Map<number, EntryItem[]>()
  for (const e of gameLists) {
    const list = gameMap.get(e.gameId) || []
    list.push({ status: e.status, score: e.score })
    gameMap.set(e.gameId, list)
  }
  for (const [id, entries] of gameMap.entries()) {
    const stats = computeStats(entries)
    await prisma.game.update({ where: { id }, data: stats }).catch(() => {})
  }
  console.log(`  • Updated stats for ${gameMap.size} games`)

  // 6. Book Lists
  const bookLists = await prisma.bookList.findMany({
    select: { bookId: true, status: true, score: true },
  })
  const bookMap = new Map<number, EntryItem[]>()
  for (const e of bookLists) {
    const list = bookMap.get(e.bookId) || []
    list.push({ status: e.status, score: e.score })
    bookMap.set(e.bookId, list)
  }
  for (const [id, entries] of bookMap.entries()) {
    const stats = computeStats(entries)
    await prisma.book.update({ where: { id }, data: stats }).catch(() => {})
  }
  console.log(`  • Updated stats for ${bookMap.size} books`)

  console.log('\n🎉 [4/4] All media statistics and favorites recalculations completed!')
}

main()
  .catch((err) => {
    console.error('❌ Error executing recalc-stats script:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
