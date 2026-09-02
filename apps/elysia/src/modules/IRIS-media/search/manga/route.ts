import { defineRoute, t } from "@/router";
import { queueMangaSearchFetch } from "@/services/media-queue";
import { NotFound } from "elysia";

import { MangaSearchResponseSchema, type MangaSearchResponse } from "./types";
import { NotFoundResponseSchema } from "../../../../../types";

const SEARCH_MANGA_TTL = 60 * 60; // 1 hour

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: MangaSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search manga",
      description: "Searches manga by title or synonyms and returns matching manga preview records.",
      tags: ["Media - Manga"],
    },
  },

  cacheKeys: {
    search: {
      manga: (q: string) => `search:manga:${q}`,
    },
  },

  async GET({ query, prisma, cache, cacheKeys, logger }) {
    const { q } = query;
    const cleanQuery = decodeURIComponent(q).replace(/\+/g, " ").trim();
    const cacheKey = cacheKeys.search.manga(cleanQuery);

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long");
    }

    const cached = await cache.get<MangaSearchResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = await prisma.manga.findMany({
      where: {
        OR: [
          { titlePrimary: { contains: cleanQuery, mode: "insensitive" } },
          { titleSecondary: { contains: cleanQuery, mode: "insensitive" } },
          { titleNative: { contains: cleanQuery, mode: "insensitive" } },
          { synonyms: { has: cleanQuery } },
        ],
      },
      select: {
        id: true,
        titlePrimary: true,
        titleSecondary: true,
        titleNative: true,
        coverImage: true,
        isAdult: true,
        format: true,
        startDateYear: true,
      },
      orderBy: {
        titlePrimary: "asc",
      },
    });

    if (data.length === 0) {
      logger.warn(`No data found for query: ${cleanQuery}, triggering refresh`);
      const results = await queueMangaSearchFetch(cleanQuery);
      await cache.set(cacheKey, results, SEARCH_MANGA_TTL);
      return results;
    }

    await cache.set(cacheKey, data, SEARCH_MANGA_TTL);
    void queueMangaSearchFetch(cleanQuery).catch((err) => {
      logger.error(`[SearchMangaRoute] Failed to queue background search for "${cleanQuery}":`, err);
    });

    return data;
  },
});
