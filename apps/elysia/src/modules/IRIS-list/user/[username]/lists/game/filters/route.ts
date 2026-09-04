import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  FilterFacetsResponseSchema,
  aggregateFacetsFromItems,
} from "@/modules/IRIS-list/helpers"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
    response: {
      200: FilterFacetsResponseSchema,
    },
    detail: {
      summary: "Get available filter options from user's game list with item counts",
      tags: ["Lists - Game"],
    },
  },

  async GET({ params, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const items = await prisma.gameList.findMany({
      where: {
        userId: dbUser.id,
        ...(!isOwner ? { private: false } : {}),
      },
      select: {
        status: true,
        game: {
          select: {
            status: true,
            releaseDateYear: true,
            genres: { select: { name: true } },
          },
        },
      },
    })

    const facets = aggregateFacetsFromItems(items as any)

    return {
      success: true,
      ...facets,
    }
  },
})
