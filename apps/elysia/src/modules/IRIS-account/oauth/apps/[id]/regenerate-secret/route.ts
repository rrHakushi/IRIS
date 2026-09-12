import { defineRoute, t } from "../../../../../../router"
import { generateClientSecret, hashClientSecret } from "../../../helpers/oauth-utils"

export default defineRoute({
  schema: {
    params: t.Object({
      id: t.String(),
    }),
  },

  POST: {
    requireAuth: true,
    schema: {
      response: {
        200: t.Object({
          success: t.Boolean(),
          clientSecret: t.String(),
        }),
      },
    },
    async handler({ params, session, prisma }) {
      const user = session.requireUser()

      const client = await prisma.oAuthClient.findFirst({
        where: { id: params.id, userId: user.id },
      })

      if (!client) {
        return new Response(
          JSON.stringify({ error: "Application not found or unauthorized" }),
          { status: 404, headers: { "content-type": "application/json" } }
        )
      }

      if (client.isPublic) {
        return new Response(
          JSON.stringify({ error: "Public clients do not possess client secrets" }),
          { status: 400, headers: { "content-type": "application/json" } }
        )
      }

      const newSecret = generateClientSecret()
      const hashedSecret = hashClientSecret(newSecret)

      await prisma.oAuthClient.update({
        where: { id: client.id },
        data: {
          clientSecret: hashedSecret,
        },
      })

      return {
        success: true,
        clientSecret: newSecret,
      }
    },
  },
})
