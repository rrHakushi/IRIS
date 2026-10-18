import { defineRoute, t } from "@/router"
import { listFileImportService } from "@/services/lists/list-file-import.service"
import { resolveTargetUserAndAccess } from "@/modules/IRIS-list/helpers"
import { Forbidden } from "@/utils/errors"

export const ExternalIdsSchema = t.Object(
  {
    anilistId: t.Optional(t.Nullable(t.Number())),
    malId: t.Optional(t.Nullable(t.Number())),
    aniDBId: t.Optional(t.Nullable(t.Number())),
    tvDBId: t.Optional(t.Nullable(t.Number())),
    bangumiId: t.Optional(t.Nullable(t.Number())),
    kitsuId: t.Optional(t.Nullable(t.Number())),
    tmdbId: t.Optional(t.Nullable(t.Number())),
    imdbId: t.Optional(t.Nullable(t.String())),
    simklId: t.Optional(t.Nullable(t.Number())),
    tvmazeId: t.Optional(t.Nullable(t.Number())),
    igdbId: t.Optional(t.Nullable(t.Number())),
    steamAppId: t.Optional(t.Nullable(t.Number())),
    rawgId: t.Optional(t.Nullable(t.Number())),
    giantbombId: t.Optional(t.Nullable(t.String())),
    vndbId: t.Optional(t.Nullable(t.String())),
    googleBookId: t.Optional(t.Nullable(t.String())),
    isbn10: t.Optional(t.Nullable(t.String())),
    isbn13: t.Optional(t.Nullable(t.String())),
    openLibraryId: t.Optional(t.Nullable(t.String())),
    deezerId: t.Optional(t.Nullable(t.String())),
    isrc: t.Optional(t.Nullable(t.String())),
    upc: t.Optional(t.Nullable(t.String())),
    deezerArtistId: t.Optional(t.Nullable(t.String())),
  },
  { additionalProperties: true }
)

export const ImportItemSchema = t.Object({
  mediaType: t.Union([
    t.Literal("anime"),
    t.Literal("manga"),
    t.Literal("tv"),
    t.Literal("movie"),
    t.Literal("game"),
    t.Literal("book"),
    t.Literal("music"),
    t.Literal("custom_lists"),
  ]),
  title: t.String(),
  externalIds: ExternalIdsSchema,
  status: t.String(),
  progress: t.Optional(t.Number()),
  progressVolumes: t.Optional(t.Nullable(t.Number())),
  progressPages: t.Optional(t.Nullable(t.Number())),
  progressChapters: t.Optional(t.Nullable(t.Number())),
  score: t.Optional(t.Nullable(t.Number())),
  notes: t.Optional(t.Nullable(t.String())),
  rewatched: t.Optional(t.Number()),
  reread: t.Optional(t.Number()),
  replayed: t.Optional(t.Number()),
  playCount: t.Optional(t.Number()),
  startedAt: t.Optional(t.Nullable(t.String())),
  completedAt: t.Optional(t.Nullable(t.String())),
  connections: t.Optional(t.Any()),
  customListName: t.Optional(t.String()),
  customNotes: t.Optional(t.Nullable(t.String())),
  order: t.Optional(t.Number()),
})

export default defineRoute({
  POST: {
    schema: {
      params: t.Object({
        username: t.String(),
      }),
      body: t.Object({
        items: t.Array(ImportItemSchema),
        skipExisting: t.Optional(t.Boolean()),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          imported: t.Number(),
          updated: t.Number(),
          skipped: t.Number(),
          queued: t.Number(),
          total: t.Number(),
        }),
      },
      detail: {
        summary: "Execute list import for authenticated user",
        tags: ["Lists - Import"],
      },
    },
    async handler({ params, body, prisma, session }) {
      // Always attribute imported items to the currently logged in user
      const { dbUser, isOwner } = await resolveTargetUserAndAccess(
        prisma,
        params.username,
        session
      )

      if (!isOwner) {
        throw new Forbidden("You can only import lists into your own account")
      }

      const result = await listFileImportService.executeImport(
        dbUser.id,
        body.items as any,
        { skipExisting: body.skipExisting }
      )

      return result
    },
  },
})
