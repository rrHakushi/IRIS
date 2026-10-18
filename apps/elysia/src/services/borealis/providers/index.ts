import { AniListProvider } from './anilist.provider'
import { TheTVDBProvider } from './tvdb.provider'
import { IGDBProvider } from './igdb.provider'
import { GoogleBooksProvider } from './google-books.provider'
import { DeezerProvider } from './deezer.provider'

export * from './anilist.provider'
export * from './tvdb.provider'
export * from './igdb.provider'
export * from './google-books.provider'
export * from './deezer.provider'

export const anilistProvider = new AniListProvider()
export const tvdbProvider = new TheTVDBProvider()
export const igdbProvider = new IGDBProvider()
export const googleBooksProvider = new GoogleBooksProvider()
export const deezerProvider = new DeezerProvider()
