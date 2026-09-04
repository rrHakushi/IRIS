import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  QuickAddResponseSchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "TV ID" }),
    }),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add TV show to list with status PLANNING",
      tags: ["Lists - TV"],
    },
  },

  async POST({ params, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)

    const tv = await prisma.tv.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!tv) {
      throw new NotFound(`TV with ID ${id} does not exist`)
    }

    const existing = await prisma.tvList.findUnique({
      where: {
        userId_tvId: {
          userId: dbUser.id,
          tvId: id,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "TV show is already in list",
      }
    }

    const created = await prisma.tvList.create({
      data: {
        userId: dbUser.id,
        tvId: id,
        status: "PLANNING",
        progress: 0,
      },
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added TV show to list with status PLANNING",
      entry: {
        id: created.id,
        tvId: created.tvId,
        status: created.status,
        progress: created.progress,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
