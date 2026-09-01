import { MusicBrainzProvider } from '../src/services/media-queue/providers/musicbrainz.provider.js';
import { LrcLibProvider } from '../src/services/media-queue/providers/lrclib.provider.js';
import fs from 'node:fs/promises';

const mb = new MusicBrainzProvider();
const lrc = new LrcLibProvider();

const searchResults = await mb.searchRecording('recording:"Never Gonna Give You Up" AND artist:"Rick Astley"');
console.log('Search results count:', searchResults.length);

if (searchResults.length > 0) {
  const mbid = searchResults[0]!.id;
  console.log('Using MBID:', mbid);

  const recording = await mb.fetchRecording(mbid);
  await fs.writeFile('../../specs/api-responses/musicbrainz_' + mbid + '.json', JSON.stringify(recording, null, 2), 'utf-8');
  console.log('Saved to specs/api-responses/musicbrainz_' + mbid + '.json');

  const lyrics = await lrc.fetchLyrics(
    recording.title,
    recording['artist-credit']?.[0]?.name || 'Rick Astley',
    recording.releases?.[0]?.title,
    recording.length ? recording.length / 1000 : undefined
  );

  if (lyrics) {
    await fs.writeFile('../../specs/api-responses/lrclib_' + mbid + '.json', JSON.stringify(lyrics, null, 2), 'utf-8');
    console.log('Saved to specs/api-responses/lrclib_' + mbid + '.json');
  }

  console.log('--- RECORDING & LYRICS DATA ---');
  console.log(JSON.stringify({
    id: recording.id,
    title: recording.title,
    artist: recording['artist-credit']?.map((a: any) => a.name).join(', '),
    album: recording.releases?.[0]?.title,
    releaseDate: recording.releases?.[0]?.date,
    durationSeconds: recording.length ? Math.round(recording.length / 1000) : undefined,
    genres: recording.genres,
    coverImageUrl: recording.coverImageUrl,
    hasLyrics: Boolean(lyrics?.syncedLyrics || lyrics?.plainLyrics),
    plainLyricsSample: lyrics?.plainLyrics?.slice(0, 150) + '...'
  }, null, 2));
}
