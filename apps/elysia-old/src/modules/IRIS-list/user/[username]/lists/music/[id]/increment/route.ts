import { defineRoute, t } from "@/router"
import {
  resolveTargetUserAndAccess,
  requireAuth,
  assertIsOwner,
  IncrementBodySchema,
} from "@/modules/IRIS-list/helpers"
import { NotFound } from "@/utils/errors"
import { MusicListStatus } from "@IRIS/database"
import { recordMediaListActivity } from "@/services/activity.service.js"

const MusicEntryResponseSchema = t.Object({
  id: t.Number(),
  musicId: t.Number(),
  albumId: t.Nullable(t.Number()),
  trackId: t.Nullable(t.Number()),
  itemType: t.String(),
  status: t.String(),
  score: t.Nullable(t.Number()),
  progress: t.Number(),
  playCount: t.Number(),
  notes: t.Nullable(t.String()),
  private: t.Boolean(),
  startedAt: t.Nullable(t.String()),
  completedAt: t.Nullable(t.String()),
  connections: t.Optional(t.Any()),
  createdAt: t.String(),
  updatedAt: t.String(),
})

const MusicIncrementBodySchema = t.Optional(
  t.Object({
    count: t.Optional(t.Number({ default: 1, minimum: 1 })),
    status: t.Optional(
      t.Union([
        t.Literal("PLANNING"),
        t.Literal("LISTENING"),
        t.Literal("COMPLETED"),
        t.Literal("ON_HOLD"),
        t.Literal("DROPPED"),
      ])
    ),
    connections: t.Optional(t.Any()),
  })
)

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
      id: t.Number({ minimum: 1, description: "Music ID" }),
    }),
    query: t.Optional(
      t.Object({
        type: t.Optional(t.Union([t.Literal("TRACK"), t.Literal("ALBUM")])),
      })
    ),
    body: MusicIncrementBodySchema,
    response: {
      200: t.Object({
        success: t.Boolean(),
        message: t.String(),
        entry: MusicEntryResponseSchema,
      }),
    },
    detail: {
      summary: "Increment music play count",
      tags: ["Lists - Music"],
    },
  },

  async POST({ params, body, prisma, session }) {
    requireAuth(session)
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )
    assertIsOwner(isOwner, params.username)

    const id = Number(params.id)
    const music = await prisma.music.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        titlePrimary: true,
        titleSecondary: true,
        coverImage: true,
      },
    })

    if (!music) {
      throw new NotFound(`Music with ID ${id} does not exist`)
    }

    const count = (body as any)?.count ?? 1

    const existing = await prisma.musicList.findUnique({
      where: {
        userId_musicId: {
          userId: dbUser.id,
          musicId: id,
        },
      },
    })

    const currentPlayCount = existing ? existing.playCount : 0
    const newPlayCount = currentPlayCount + count
    let newStatus: MusicListStatus =
      (body as any)?.status ??
      (existing?.status as MusicListStatus) ??
      "LISTENING"

    if (newStatus === "PLANNING") {
      newStatus = "LISTENING"
    }

    const result = await prisma.musicList.upsert({
      where: {
        userId_musicId: {
          userId: dbUser.id,
          musicId: id,
        },
      },
      create: {
        userId: dbUser.id,
        musicId: id,
        status: newStatus,
        playCount: newPlayCount,
        startedAt: new Date(),
        connections: (body as any)?.connections ?? null,
      },
      update: {
        playCount: newPlayCount,
        status: newStatus,
        ...((body as any)?.connections !== undefined
          ? { connections: (body as any).connections }
          : {}),
      },
    })

    recordMediaListActivity({
      userId: dbUser.id,
      mediaType: "MUSIC",
      mediaId: id,
      action: "PROGRESS_CHANGED",
      title: music.titlePrimary || music.titleSecondary || "Music",
      coverImage: music.coverImage,
      format: music.type,
      status: result.status,
      progress: result.playCount,
      score: result.score,
      prevStatus: existing?.status,
      prevProgress: currentPlayCount,
      prevScore: existing?.score,
      isPrivate: result.private,
    })

    return {
      success: true,
      message: `Play count incremented to ${newPlayCount}`,
      entry: {
        id: result.id,
        musicId: id,
        albumId: music.type === "ALBUM" ? id : null,
        trackId: music.type === "TRACK" ? id : null,
        itemType: music.type,
        status: result.status,
        score: result.score ?? null,
        progress: result.playCount,
        playCount: result.playCount,
        notes: result.notes ?? null,
        private: result.private ?? false,
        startedAt: result.startedAt ? result.startedAt.toISOString() : null,
        completedAt: result.completedAt
          ? result.completedAt.toISOString()
          : null,
        connections: result.connections,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      },
    }
  },
})
