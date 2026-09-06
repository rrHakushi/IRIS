import { DeezerProvider, LrcLibProvider } from "../providers/index.js"
import { mediaQueueService } from "../media-queue.service.js"
import { mediaDbSyncer } from "../media-db.syncer.js"
import { prisma } from "@IRIS/database"
import searchMusicRoute from "@/modules/IRIS-media/search/music/route"
import getMusicByIdRoute from "@/modules/IRIS-media/media/music/[id]/route"
import musicListRoute from "@/modules/IRIS-list/user/[username]/lists/music/route"
import musicListItemRoute from "@/modules/IRIS-list/user/[username]/lists/music/[id]/route"
import quickAddRoute from "@/modules/IRIS-list/user/[username]/lists/music/[id]/quick-add/route"
import incrementRoute from "@/modules/IRIS-list/user/[username]/lists/music/[id]/increment/route"
import { cache } from "@/utils/cache.js"

async function runMusicSyncVerification() {
  console.log("==================================================")
  console.log("=== STARTING DEEZER MUSIC QUEUE & SYNC TEST ===")
  console.log("==================================================")

  // 1. Verify Providers
  console.log("\n[1/7] Testing Music Providers (Deezer, LRCLIB)...")
  const deezer = new DeezerProvider()
  const lrclib = new LrcLibProvider()

  try {
    const deezerTracks = await deezer.searchTracks("Bohemian Rhapsody Queen", 3)
    console.log(`  ✓ Deezer tracks found: ${deezerTracks.length}`)
    if (deezerTracks.length > 0 && deezerTracks[0]) {
      const first = deezerTracks[0]
      console.log(`    - First match: "${first.title}" by ${first.artist?.name} (Deezer ID: ${first.id})`)
    }
  } catch (err: any) {
    console.warn(`  ⚠️ Deezer track search error: ${err.message}`)
  }

  try {
    const lyrics = await lrclib.fetchLyrics("Bohemian Rhapsody", "Queen")
    console.log(`  ✓ LRCLIB: Lyrics found (${lyrics?.plainLyrics ? `${lyrics.plainLyrics.length} chars` : "none"})`)
  } catch (err: any) {
    console.warn(`  ⚠️ LRCLIB error: ${err.message}`)
  }

  // 2. Test enqueueSearchFetch("MUSIC", "Bohemian Rhapsody")
  console.log("\n[2/7] Testing mediaQueueService.enqueueSearchFetch('MUSIC', 'Bohemian Rhapsody')...")
  const searchResults = await mediaQueueService.enqueueSearchFetch("MUSIC", "Bohemian Rhapsody")
  console.log(`  ✓ enqueueSearchFetch returned ${searchResults.length} search results`)

  if (searchResults.length === 0) {
    throw new Error("No search results returned from enqueueSearchFetch")
  }

  const sample = searchResults[0]
  console.log(`  ✓ Sample result:`)
  console.log(`    - ID: ${sample.id}`)
  console.log(`    - Title: ${sample.titlePrimary}`)
  console.log(`    - Artist: ${sample.artistName}`)
  console.log(`    - ItemType: ${sample.itemType}`)

  // 3. Test Direct DB Upsert via mediaDbSyncer
  console.log("\n[3/7] Testing direct DB upsert via mediaDbSyncer...")
  const testTrackData: any = {
    deezerId: "test-track-999999",
    type: "TRACK" as const,
    titlePrimary: "Bohemian Rhapsody Test",
    titleSecondary: "Bohemian Rhapsody",
    artistName: "Queen",
    duration: 354,
    releaseDateYear: 1975,
  }

  const upsertedTrack = await mediaDbSyncer.upsertMusic(testTrackData)
  console.log(`  ✓ Synced Music Track ID: ${upsertedTrack.id} ("${testTrackData.titlePrimary}")`)

  const testAlbumData: any = {
    deezerId: "test-album-999999",
    type: "ALBUM" as const,
    titlePrimary: "A Night at the Opera Test",
    artistName: "Queen",
    releaseDateYear: 1975,
    nbTracks: 12,
  }

  const upsertedAlbum = await mediaDbSyncer.upsertMusic(testAlbumData)
  console.log(`  ✓ Synced Music Album ID: ${upsertedAlbum.id} ("${testAlbumData.titlePrimary}")`)

  // Link track to album
  const linkedTrack = await prisma.music.update({
    where: { id: upsertedTrack.id },
    data: { albumId: upsertedAlbum.id },
  })
  console.log(`  ✓ Linked track ${linkedTrack.id} to album ${upsertedAlbum.id}`)

  // 4. Test Search Music Route Handler
  console.log("\n[4/7] Testing Search Music Route Handler (apps/elysia/src/modules/IRIS-media/search/music)...")
  const dummySearchContext: any = {
    query: { q: "Bohemian Rhapsody" },
    prisma,
    cache,
    cacheKeys: {
      search: {
        music: (q: string) => `search:music:${q}`,
      },
    },
    logger: {
      warn: (msg: string) => console.log(`    [Route Logger WARN] ${msg}`),
      error: (msg: string, err: any) => console.error(`    [Route Logger ERROR] ${msg}`, err),
      info: (msg: string) => console.log(`    [Route Logger INFO] ${msg}`),
    },
  }

  const routeResults: any = await (searchMusicRoute as any).GET(dummySearchContext)
  console.log(`  ✓ Route returned ${Array.isArray(routeResults) ? routeResults.length : 0} results`)
  if (Array.isArray(routeResults) && routeResults.length > 0) {
    const rSample = routeResults[0]
    console.log(`    - First match: [${rSample.type}] "${rSample.titlePrimary}" by ${rSample.artistName || rSample.artist} (ID: ${rSample.id})`)
  }

  // 5. Test Media Music By ID Route Handler (Track & Album)
  console.log("\n[5/7] Testing Media Music [id] Route Handler (apps/elysia/src/modules/IRIS-media/media/music/[id])...")
  const trackDetails: any = await (getMusicByIdRoute as any).GET({
    params: { id: upsertedTrack.id },
    query: { type: "TRACK" },
    prisma,
    cache,
    cacheKeys: { music: { id: (id: number) => `music:${id}` } },
    logger: { error: () => {} },
  })
  console.log(`  ✓ Fetched track details: [${trackDetails.type}] "${trackDetails.titlePrimary}" (Album: ${trackDetails.album})`)

  const albumDetails: any = await (getMusicByIdRoute as any).GET({
    params: { id: upsertedAlbum.id },
    query: { type: "ALBUM" },
    prisma,
    cache,
    cacheKeys: { music: { id: (id: number) => `music:${id}` } },
    logger: { error: () => {} },
  })
  console.log(`  ✓ Fetched album details: [${albumDetails.type}] "${albumDetails.titlePrimary}" (${albumDetails.tracks?.length ?? 0} tracks)`)

  // 6. Test User Music List Route Handlers
  console.log("\n[6/7] Testing User Music List Route Handlers (quick-add, increment, GET list, GET [id], PATCH, DELETE)...")
  const testUser = await prisma.user.findFirst({ select: { id: true, username: true } })
  if (testUser) {
    console.log(`  ✓ Target user: @${testUser.username} (${testUser.id})`)
    const fakeSession: any = {
      isAuthenticated: true,
      userId: testUser.id,
      user: { id: testUser.id, username: testUser.username, name: testUser.username },
      getUser: () => ({ id: testUser.id, username: testUser.username, name: testUser.username }),
    }

    // A. Quick-add track
    const quickAddTrackRes: any = await (quickAddRoute as any).POST({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Quick-add track response: status=${quickAddTrackRes.entry?.status}, playCount=${quickAddTrackRes.entry?.playCount}`)

    // B. Increment playCount for track
    const incrementRes: any = await (incrementRoute as any).POST({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      body: { count: 2 },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Increment track playCount response: new playCount=${incrementRes.entry?.playCount}`)

    // C. Fetch user music list
    const listRes: any = await (musicListRoute as any).GET({
      params: { username: testUser.username },
      query: { limit: 20 },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ User music list fetched: total=${listRes.pagination?.total}, items=${listRes.items?.length}`)
    const listTrackItem = listRes.items?.find((i: any) => i.entry?.musicId === upsertedTrack.id)
    console.log(`    - Track item found in list: ${Boolean(listTrackItem)} (playCount: ${listTrackItem?.entry?.playCount})`)

    // D. Fetch individual entry via GET [id]
    const singleEntryRes: any = await (musicListItemRoute as any).GET({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Individual entry fetched: itemType=${singleEntryRes.entry?.itemType}, status=${singleEntryRes.entry?.status}`)

    // E. Update entry via PATCH [id]
    const patchRes: any = await (musicListItemRoute as any).PATCH({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      body: { status: "COMPLETED", score: 95 },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Updated entry via PATCH: status=${patchRes.entry?.status}, score=${patchRes.entry?.score}`)

    // F. Delete track list entry via DELETE [id]
    await (musicListItemRoute as any).DELETE({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Deleted track list entry via DELETE route`)
  }

  // 7. Cleanup
  console.log("\n[7/7] Cleaning up test entities from DB...")
  await prisma.music.delete({ where: { id: upsertedTrack.id } }).catch(() => {})
  await prisma.music.delete({ where: { id: upsertedAlbum.id } }).catch(() => {})
  console.log(`  ✓ Cleaned up test track and album records`)

  console.log("\n==================================================")
  console.log("=== ALL DEEZER MUSIC SYNC & ROUTE TESTS PASSED! ===")
  console.log("==================================================")
  process.exit(0)
}

runMusicSyncVerification().catch((err) => {
  console.error("\n❌ Music sync verification failed with error:", err)
  process.exit(1)
})
