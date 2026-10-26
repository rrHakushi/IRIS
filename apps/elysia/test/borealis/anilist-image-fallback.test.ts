import { describe, expect, it } from 'bun:test'
import { AniListAdapter } from '@IRIS/connections'
import { anilistProvider } from '../../src/services/borealis/providers'

describe('AniList Image Resolution & Fallback Policy', () => {
  describe('Resolution Priority Rules', () => {
    // Helper replicating the standardized media cover fallback logic across the codebase
    function resolveMediaCover(coverImage?: {
      extraLarge?: string
      large?: string
      medium?: string
    }): string | null {
      return coverImage?.extraLarge || coverImage?.large || coverImage?.medium || null
    }

    // Helper replicating the standardized character/staff/avatar image fallback logic
    function resolvePersonImage(image?: {
      large?: string
      medium?: string
    }): string | null {
      return image?.large || image?.medium || null
    }

    it('prefers extraLarge cover image when extraLarge, large, and medium are all present', () => {
      const cover = {
        extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/extralarge/bx1-large.jpg',
        large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-large.jpg',
        medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1-medium.jpg',
      }
      expect(resolveMediaCover(cover)).toBe(cover.extraLarge)
    })

    it('prefers large cover image when extraLarge is missing but medium is present', () => {
      const cover = {
        large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2-large.jpg',
        medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx2-medium.jpg',
      }
      expect(resolveMediaCover(cover)).toBe(cover.large)
    })

    it('falls back to medium cover image only when both extraLarge and large are missing', () => {
      const cover = {
        medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx3-medium.jpg',
      }
      expect(resolveMediaCover(cover)).toBe(cover.medium)
    })

    it('returns null when coverImage object is empty or undefined', () => {
      expect(resolveMediaCover({})).toBeNull()
      expect(resolveMediaCover(undefined)).toBeNull()
    })

    it('prefers large character/staff image over medium', () => {
      const personImg = {
        large: 'https://s4.anilist.co/file/anilistcdn/character/large/b40-large.jpg',
        medium: 'https://s4.anilist.co/file/anilistcdn/character/medium/b40-medium.jpg',
      }
      expect(resolvePersonImage(personImg)).toBe(personImg.large)
    })

    it('falls back to medium character/staff image when large is missing', () => {
      const personImg = {
        medium: 'https://s4.anilist.co/file/anilistcdn/character/medium/b41-medium.jpg',
      }
      expect(resolvePersonImage(personImg)).toBe(personImg.medium)
    })

    it('returns null when character/staff image is empty or undefined', () => {
      expect(resolvePersonImage({})).toBeNull()
      expect(resolvePersonImage(undefined)).toBeNull()
    })
  })

  describe('AniList Adapter (@IRIS/connections)', () => {
    it('selects large avatar with fallback to medium in getProfile', async () => {
      const adapter = new AniListAdapter()
      let executedQuery = ''

      ;(adapter as any).executeGraphQL = async (query: string) => {
        executedQuery = query
        return {
          Viewer: {
            id: 12345,
            name: 'TestUser',
            avatar: {
              large: 'https://s4.anilist.co/avatar/large/u12345.jpg',
              medium: 'https://s4.anilist.co/avatar/medium/u12345.jpg',
            },
            siteUrl: 'https://anilist.co/user/TestUser',
          },
        }
      }

      const profile = await adapter.getProfile({ accessToken: 'mock-token' })
      expect(profile.avatarUrl).toBe('https://s4.anilist.co/avatar/large/u12345.jpg')
      expect(executedQuery).toContain('avatar')
    })

    it('falls back to medium avatar in getProfile when large is absent', async () => {
      const adapter = new AniListAdapter()

      ;(adapter as any).executeGraphQL = async () => ({
        Viewer: {
          id: 12345,
          name: 'TestUser',
          avatar: {
            medium: 'https://s4.anilist.co/avatar/medium/u12345.jpg',
          },
          siteUrl: 'https://anilist.co/user/TestUser',
        },
      })

      const profile = await adapter.getProfile({ accessToken: 'mock-token' })
      expect(profile.avatarUrl).toBe('https://s4.anilist.co/avatar/medium/u12345.jpg')
    })

    it('requests extraLarge and large coverImage in searchMedia GraphQL query', async () => {
      const adapter = new AniListAdapter()
      let executedQuery = ''

      ;(adapter as any).executeGraphQL = async (query: string) => {
        executedQuery = query
        return {
          Page: {
            media: [
              {
                id: 1,
                type: 'ANIME',
                title: { userPreferred: 'Cowboy Bebop' },
                coverImage: {
                  extraLarge: 'https://s4.anilist.co/cover/extralarge/1.jpg',
                  large: 'https://s4.anilist.co/cover/large/1.jpg',
                  medium: 'https://s4.anilist.co/cover/medium/1.jpg',
                },
              },
            ],
          },
        }
      }

      const results = await adapter.searchMedia('Cowboy Bebop')
      expect(executedQuery).toContain('extraLarge')
      expect(executedQuery).toContain('large')
      expect(executedQuery).toContain('medium')
      expect(results[0]?.coverImage?.extraLarge).toBe('https://s4.anilist.co/cover/extralarge/1.jpg')
    })
  })

  describe('AniList Provider (apps/elysia)', () => {
    it('exposes methods and executes GraphQL queries requesting extraLarge & large images', async () => {
      let executedQuery = ''
      ;(anilistProvider as any).executeGraphQL = async (query: string) => {
        executedQuery = query
        return {
          Page: {
            media: [
              {
                id: 50,
                title: { userPreferred: 'Test Anime' },
                coverImage: {
                  extraLarge: 'https://example.com/xl.jpg',
                  large: 'https://example.com/lg.jpg',
                  medium: 'https://example.com/md.jpg',
                },
              },
            ],
          },
        }
      }

      const results = await anilistProvider.searchAnime('Test')
      expect(executedQuery).toContain('extraLarge')
      expect(executedQuery).toContain('large')
      expect(executedQuery).toContain('medium')
      expect(results[0]?.coverImage?.extraLarge).toBe('https://example.com/xl.jpg')
    })

    it('requests extraLarge & large images in searchManga query', async () => {
      let executedQuery = ''
      ;(anilistProvider as any).executeGraphQL = async (query: string) => {
        executedQuery = query
        return {
          Page: {
            media: [
              {
                id: 60,
                title: { userPreferred: 'Test Manga' },
                coverImage: {
                  extraLarge: 'https://example.com/manga-xl.jpg',
                  large: 'https://example.com/manga-lg.jpg',
                  medium: 'https://example.com/manga-md.jpg',
                },
              },
            ],
          },
        }
      }

      const results = await anilistProvider.searchManga('Test Manga')
      expect(executedQuery).toContain('extraLarge')
      expect(executedQuery).toContain('large')
      expect(executedQuery).toContain('medium')
      expect(results[0]?.coverImage?.extraLarge).toBe('https://example.com/manga-xl.jpg')
    })
  })
})
