import { defineRoute, t } from "../../../../router"
import { NotFound } from "../../../../utils/errors"
import { UserCustomizationSchema } from "../me/route"

export default defineRoute({
  GET: {
    schema: {
      params: t.Object({
        username: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          user: t.Object({
            id: t.String(),
            username: t.String(),
            customization: t.Nullable(UserCustomizationSchema),
            createdAt: t.String(),
          }),
        }),
      },
      detail: {
        summary: "Get public user profile by username",
        tags: ["Users"],
      },
    },
    async handler({ params, prisma }) {
      const username = params.username?.trim()
      if (!username) {
        throw new NotFound("User not found")
      }

      const dbUser = await prisma.user.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
        },
        select: {
          id: true,
          username: true,
          customization: true,
          createdAt: true,
        },
      })

      if (!dbUser) {
        throw new NotFound(`User "${username}" not found`)
      }

      return {
        success: true,
        user: {
          id: dbUser.id,
          username: dbUser.username.trim(),
          customization: dbUser.customization as any,
          createdAt: dbUser.createdAt.toISOString(),
        },
      }
    },
  },
})
