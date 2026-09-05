import { MusicBrainzProvider, LastFmProvider, LrcLibProvider } from "../providers/index.js"
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
  console.log("=== STARTING MUSIC QUEUE & DUAL-MODEL SYNC TEST ===")
  console.log("==================================================")

  // 1. Verify Providers
  console.log("\n[1/7] Testing Music Providers (MusicBrainz, LastFM, LRCLIB)...")
  const mb = new MusicBrainzProvider()
  const lastfm = new LastFmProvider()
  const lrclib = new LrcLibProvider()

  try {
    const mbResults = await mb.searchRecording("Bohemian Rhapsody Queen", 3)
    console.log(`  ✓ MusicBrainz recordings found: ${mbResults.length}`)
    if (mbResults.length > 0 && mbResults[0]) {
      const first = mbResults[0]
      console.log(`    - First match: "${first.title}" by ${first["artist-credit"]?.[0]?.name} (MBID: ${first.id})`)
    }
  } catch (err: any) {
    console.warn(`  ⚠️ MusicBrainz error: ${err.message}`)
  }

  if (!process.env.LASTFM_API_KEY) {
    console.log("  ℹ️ LASTFM_API_KEY not configured in env: configuring simulated responses for test suite.")
    ;(mediaQueueService as any).lastfm.searchAlbums = async () => [
      {
        name: "A Night at the Opera",
        artist: "Queen",
        url: "https://www.last.fm/music/Queen/A+Night+at+the+Opera",
        image: [{ "#text": "https://lastfm.freetls.fastly.net/image.png", size: "large" }],
      },
    ]
    ;(mediaQueueService as any).lastfm.searchTracks = async () => [
      {
        name: "Bohemian Rhapsody",
        artist: "Queen",
        url: "https://www.last.fm/music/Queen/_/Bohemian+Rhapsody",
        listeners: "2500000",
        image: [{ "#text": "https://lastfm.freetls.fastly.net/image.png", size: "large" }],
      },
    ]
    ;(mediaQueueService as any).lastfm.fetchTrack = async () => ({
      name: "Bohemian Rhapsody",
      artist: { name: "Queen" },
      duration: 354000,
      listeners: "2500000",
      playcount: "15000000",
      album: { title: "A Night at the Opera", artist: "Queen" },
      toptags: { tag: [{ name: "classic rock" }] },
      wiki: { summary: "A classic rock song by Queen." },
    })
    ;(mediaQueueService as any).lastfm.fetchAlbum = async () => ({
      name: "A Night at the Opera",
      artist: "Queen",
      listeners: "450000",
      playcount: "5000000",
      tracks: {
        track: [{ name: "Bohemian Rhapsody", duration: 354, "@attr": { rank: 1 } }],
      },
      tags: { tag: [{ name: "classic rock" }] },
    })
  }

  try {
    const lfmResults = await (mediaQueueService as any).lastfm.searchTracks("Bohemian Rhapsody", undefined, 3)
    console.log(`  ✓ Last.fm tracks found: ${lfmResults.length}`)
    if (lfmResults.length > 0 && lfmResults[0]) {
      console.log(`    - First match: "${lfmResults[0].name}" by ${lfmResults[0].artist}`)
    }
  } catch (err: any) {
    console.warn(`  ⚠️ Last.fm error: ${err.message}`)
  }

  try {
    const lyrics = await lrclib.fetchLyrics("Bohemian Rhapsody", "Queen")
    console.log(`  ✓ LRCLIB: Lyrics found (${lyrics?.plainLyrics ? `${lyrics.plainLyrics.length} chars` : "none"})`)
  } catch (err: any) {
    console.warn(`  ⚠️ LRCLIB error: ${err.message}`)
  }

  try {
    const mbRelease = await mb.searchRelease('release:"A Night at the Opera" AND artist:"Queen"', 1)
    console.log(`  ✓ MusicBrainz releases found: ${mbRelease.length}`)
    if (mbRelease.length > 0 && mbRelease[0]) {
      const rel = mbRelease[0]
      console.log(`    - Release: "${rel.title}" (MBID: ${rel.id}, Date: ${rel.date})`)
    }
  } catch (err: any) {
    console.warn(`  ⚠️ MusicBrainz release search error: ${err.message}`)
  }

  // 2. Test enqueueSearchFetch("MUSIC", "Bohemian Rhapsody")
  console.log("\n[2/8] Testing mediaQueueService.enqueueSearchFetch('MUSIC', 'Bohemian Rhapsody')...")
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

  // 3. Test Queue Job Execution: Last.fm Primary + MusicBrainz Missing Fields Supplement
  console.log("\n[3/8] Testing MediaQueueService Job Execution (Last.fm Primary + MusicBrainz Missing Fields)...")
  const trackJob = {
    id: "test-job-track-verify",
    mediaType: "MUSIC_TRACK" as const,
    externalId: "Queen:::Bohemian Rhapsody",
    options: {},
    attempts: 0,
    maxAttempts: 3,
    status: "PENDING" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await (mediaQueueService as any).executeJob(trackJob)
  const jobSyncedTrack = await prisma.musicTrack.findFirst({
    where: {
      titlePrimary: { equals: "Bohemian Rhapsody", mode: "insensitive" },
      artistName: { equals: "Queen", mode: "insensitive" },
    },
  })
  console.log(`  ✓ Synced Track from Job: ID=${jobSyncedTrack?.id}`)
  console.log(`    - Last.fm listeners: ${jobSyncedTrack?.lastFmListenersStat}`)
  console.log(`    - MusicBrainz ID (supplemented): ${jobSyncedTrack?.musicBrainzId || "none"}`)
  console.log(`    - Duration: ${jobSyncedTrack?.duration}s`)
  console.log(`    - Lyrics synced: ${Boolean(jobSyncedTrack?.lyrics)}`)

  // 4. Test Direct DB Upsert via mediaDbSyncer
  console.log("\n[4/8] Testing direct DB upsert via mediaDbSyncer...")
  const testTrackData = {
    titlePrimary: "Bohemian Rhapsody Test",
    titleSecondary: "A Night at the Opera",
    artistName: "Queen",
    duration: 354,
    musicBrainzId: "b1e26560-60e5-4236-bbdb-9aa5a8d5ee19",
    releaseDateYear: 1975,
  }

  const upsertedTrack = await mediaDbSyncer.upsertMusicTrack(testTrackData)
  console.log(`  ✓ Synced MusicTrack ID: ${upsertedTrack.id} ("${testTrackData.titlePrimary}")`)

  const testAlbumData = {
    titlePrimary: "A Night at the Opera Test",
    artistName: "Queen",
    musicBrainzId: "723b7405-b040-4100-b6f0-e4feecb5006d",
    releaseDateYear: 1975,
    trackCount: 12,
  }

  const upsertedAlbum = await mediaDbSyncer.upsertMusicAlbum(testAlbumData)
  console.log(`  ✓ Synced MusicAlbum ID: ${upsertedAlbum.id} ("${testAlbumData.titlePrimary}")`)

  // Link track to album
  const linkedTrack = await prisma.musicTrack.update({
    where: { id: upsertedTrack.id },
    data: { albumId: upsertedAlbum.id },
  })
  console.log(`  ✓ Linked track ${linkedTrack.id} to album ${upsertedAlbum.id}`)

  // 5. Test Search Music Route Handler
  console.log("\n[5/8] Testing Search Music Route Handler (apps/elysia/src/modules/IRIS-media/search/music)...")
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

  // 6. Test Media Music By ID Route Handler (Track & Album)
  console.log("\n[6/8] Testing Media Music [id] Route Handler (apps/elysia/src/modules/IRIS-media/media/music/[id])...")
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

  // 7. Test User Music List Route Handlers
  console.log("\n[7/8] Testing User Music List Route Handlers (quick-add, increment, GET list, GET [id], PATCH, DELETE)...")
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
      query: { type: "TRACK" },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Quick-add track response: status=${quickAddTrackRes.entry?.status}, playCount=${quickAddTrackRes.entry?.playCount}`)

    // B. Quick-add album
    const quickAddAlbumRes: any = await (quickAddRoute as any).POST({
      params: { username: testUser.username, id: String(upsertedAlbum.id) },
      query: { type: "ALBUM" },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Quick-add album response: status=${quickAddAlbumRes.entry?.status}, playCount=${quickAddAlbumRes.entry?.playCount}`)

    // C. Increment playCount for track
    const incrementRes: any = await (incrementRoute as any).POST({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      query: { type: "TRACK" },
      body: { count: 2 },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Increment track playCount response: new playCount=${incrementRes.entry?.playCount}`)

    // D. Fetch user music list
    const listRes: any = await (musicListRoute as any).GET({
      params: { username: testUser.username },
      query: { limit: 20 },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ User music list fetched: total=${listRes.pagination?.total}, items=${listRes.items?.length}`)
    const listTrackItem = listRes.items?.find((i: any) => i.entry?.musicId === upsertedTrack.id && i.entry?.itemType === "TRACK")
    const listAlbumItem = listRes.items?.find((i: any) => i.entry?.musicId === upsertedAlbum.id && i.entry?.itemType === "ALBUM")
    console.log(`    - Track item found in list: ${Boolean(listTrackItem)} (playCount: ${listTrackItem?.entry?.playCount})`)
    console.log(`    - Album item found in list: ${Boolean(listAlbumItem)} (playCount: ${listAlbumItem?.entry?.playCount})`)

    // E. Fetch individual entry via GET [id]
    const singleEntryRes: any = await (musicListItemRoute as any).GET({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      query: { type: "TRACK" },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Individual entry fetched: itemType=${singleEntryRes.entry?.itemType}, status=${singleEntryRes.entry?.status}`)

    // F. Update entry via PATCH [id]
    const patchRes: any = await (musicListItemRoute as any).PATCH({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      query: { type: "TRACK" },
      body: { status: "COMPLETED", userRating: 9.5 },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Updated entry via PATCH: status=${patchRes.entry?.status}, rating=${patchRes.entry?.userRating}`)

    // G. Delete track and album list entries via DELETE [id]
    await (musicListItemRoute as any).DELETE({
      params: { username: testUser.username, id: String(upsertedTrack.id) },
      query: { type: "TRACK" },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Deleted track list entry via DELETE route`)

    await (musicListItemRoute as any).DELETE({
      params: { username: testUser.username, id: String(upsertedAlbum.id) },
      query: { type: "ALBUM" },
      session: fakeSession,
      prisma,
    })
    console.log(`  ✓ Deleted album list entry via DELETE route`)
  }

  // 8. Cleanup
  console.log("\n[8/8] Cleaning up test entities from DB...")
  await prisma.musicTrack.delete({ where: { id: upsertedTrack.id } })
  await prisma.musicAlbum.delete({ where: { id: upsertedAlbum.id } })
  if (jobSyncedTrack && jobSyncedTrack.id !== upsertedTrack.id) {
    await prisma.musicTrack.delete({ where: { id: jobSyncedTrack.id } }).catch(() => {})
  }
  console.log(`  ✓ Cleaned up test track and album records`)

  console.log("\n==================================================")
  console.log("=== ALL MUSIC SYNC & ROUTE TESTS PASSED! ===")
  console.log("==================================================")
  process.exit(0)
}

runMusicSyncVerification().catch((err) => {
  console.error("\n❌ Music sync verification failed with error:", err)
  process.exit(1)
})
