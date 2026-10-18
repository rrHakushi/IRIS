import { defineRoute, t } from "@/router"
import { NotFound } from "elysia"

import { StudioSearchResponseSchema, type StudioSearchResponse } from "./types"
import { NotFoundResponseSchema } from "../../../../../types"

export default defineRoute({
  schema: {
    query: t.Object({
      q: t.String({
        description: "Search query string (minimum 3 characters)",
        minLength: 3,
      }),
    }),
    response: {
      200: StudioSearchResponseSchema,
      404: NotFoundResponseSchema,
    },
    detail: {
      summary: "Search studios",
      description:
        "Searches production and animation studios by name and returns matching studio preview records.",
      tags: ["Media - Studio"],
    },
  },

  async GET({ query, prisma }) {
    const cleanQuery = decodeURIComponent(String(query.q || ""))
      .replace(/\+/g, " ")
      .trim()

    if (!cleanQuery || cleanQuery.length < 3) {
      return new NotFound("Query must be at least 3 characters long")
    }

    const data = await prisma.studio.findMany({
      where: {
        name: { contains: cleanQuery, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        isAnimationStudio: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    return data
  },
})
