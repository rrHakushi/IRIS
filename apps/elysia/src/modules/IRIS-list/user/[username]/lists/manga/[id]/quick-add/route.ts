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
      id: t.Number({ minimum: 1, description: "Manga ID" }),
    }),
    response: {
      200: QuickAddResponseSchema,
    },
    detail: {
      summary: "Quick add manga to list with status PLANNING",
      tags: ["Lists - Manga"],
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

    const manga = await prisma.manga.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!manga) {
      throw new NotFound(`Manga with ID ${id} does not exist`)
    }

    const existing = await prisma.mangaList.findUnique({
      where: {
        userId_mangaId: {
          userId: dbUser.id,
          mangaId: id,
        },
      },
    })

    if (existing) {
      return {
        success: false,
        alreadyExists: true,
        message: "Manga is already in list",
      }
    }

    const created = await prisma.mangaList.create({
      data: {
        userId: dbUser.id,
        mangaId: id,
        status: "PLANNING",
        chaptersProgress: 0,
        volumesProgress: 0,
      },
    })

    return {
      success: true,
      alreadyExists: false,
      message: "Added manga to list with status PLANNING",
      entry: {
        id: created.id,
        mangaId: created.mangaId,
        status: created.status,
        chaptersProgress: created.chaptersProgress,
        volumesProgress: created.volumesProgress,
        createdAt: created.createdAt.toISOString(),
      },
    }
  },
})
