import { defineRoute, t } from "@/router"
import { listExportService } from "@/services/lists/list-export.service"
import { resolveTargetUserAndAccess } from "@/modules/IRIS-list/helpers"
import { Forbidden } from "@/utils/errors"

export default defineRoute({
  schema: {
    params: t.Object({
      username: t.String(),
    }),
    response: {
      200: t.Object({
        success: t.Boolean(),
        shares: t.Array(
          t.Object({
            id: t.String(),
            description: t.Nullable(t.String()),
            mediaTypes: t.Array(t.String()),
            createdAt: t.String(),
            expiresAt: t.Nullable(t.String()),
            lastUsedAt: t.Nullable(t.String()),
            isExpired: t.Boolean(),
          })
        ),
      }),
    },
    detail: {
      summary: "List user's active export share URLs",
      tags: ["Lists - Export"],
    },
  },

  async GET({ params, prisma, session }) {
    const { dbUser, isOwner } = await resolveTargetUserAndAccess(
      prisma,
      params.username,
      session
    )

    if (!isOwner) {
      throw new Forbidden("You can only view your own export shares")
    }

    const shares = await listExportService.listShares(dbUser.id)
    return {
      success: true,
      shares,
    }
  },
})
