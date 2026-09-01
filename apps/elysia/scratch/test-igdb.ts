import { IGDBProvider } from '../src/services/media-queue/providers/igdb.provider.js';

const igdb = new IGDBProvider();
const token = await (igdb as any).getValidToken();
const clientId = (igdb as any).getClientId();

const query = `
  fields 
    name, slug, summary, storyline,
    cover.image_id, screenshots.image_id, artworks.image_id,
    first_release_date,
    release_dates.date, release_dates.human, release_dates.platform.name, release_dates.platform.abbreviation, release_dates.region,
    genres.name,
    themes.name,
    keywords.name,
    game_modes.name,
    player_perspectives.name,
    category,
    franchise.name, franchises.name, collection.name,
    involved_companies.developer, involved_companies.publisher, involved_companies.porting, involved_companies.supporting, involved_companies.company.name,
    rating, rating_count, aggregated_rating, aggregated_rating_count, total_rating, total_rating_count,
    status,
    websites.url, websites.category,
    videos.video_id, videos.name,
    external_games.category, external_games.uid, external_games.url,
    age_ratings.rating, age_ratings.category, age_ratings.content_descriptions.description,
    alternative_names.name, alternative_names.comment,
    game_engines.name,
    language_supports.language.name, language_supports.language_support_type.name;
  where id = 1942;
`;

const res = await fetch('https://api.igdb.com/v4/games', {
  method: 'POST',
  headers: {
    'Client-ID': clientId,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'text/plain',
    'Accept': 'application/json'
  },
  body: query
});

const data = await res.json();
import fs from 'node:fs/promises';
await fs.writeFile('../../specs/api-responses/igdb_1942.json', JSON.stringify(data[0], null, 2), 'utf-8');
console.log('Saved to specs/api-responses/igdb_1942.json');
