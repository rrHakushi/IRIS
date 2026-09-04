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
      summary: "Get available filter options from user's TV list with item counts",
      tags: ["Lists - TV"],
    },
  },

  async GET({ params, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    const items = await prisma.tvList.findMany({
      where: {
        userId: dbUser.id,
        ...(!isOwner ? { private: false } : {}),
      },
      select: {
        status: true,
        tv: {
          select: {
            showType: true,
            status: true,
            firstAiredYear: true,
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
