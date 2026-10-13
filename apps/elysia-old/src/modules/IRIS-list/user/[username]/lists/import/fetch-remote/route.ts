import { defineRoute, t } from "@/router"
import { resolveTargetUserAndAccess } from "@/modules/IRIS-list/helpers"
import { Forbidden, BadRequest } from "@/utils/errors"

export default defineRoute({
  POST: {
    schema: {
      params: t.Object({
        username: t.String(),
      }),
      body: t.Object({
        url: t.String({ description: "Remote IRIS export URL" }),
        password: t.String({
          description: "Password for the remote export share",
        }),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          data: t.Any(),
        }),
      },
      detail: {
        summary: "Fetch and preview remote IRIS export URL with password",
        tags: ["Lists - Import"],
      },
    },
    async handler({ params, body, prisma, session }) {
      const { isOwner } = await resolveTargetUserAndAccess(
        prisma,
        params.username,
        session
      )

      if (!isOwner) {
        throw new Forbidden(
          "You can only fetch remote imports for your own account"
        )
      }

      let targetUrl = body.url.trim()
      // Normalize URL if user pasted bare link without endpoint
      if (
        !targetUrl.startsWith("http://") &&
        !targetUrl.startsWith("https://")
      ) {
        targetUrl = `https://${targetUrl}`
      }

      try {
        const res = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ password: body.password }),
        })

        if (!res.ok) {
          let errMsg = `Remote server responded with HTTP ${res.status}`
          try {
            const errJson = (await res.json()) as any
            if (errJson?.message || errJson?.error) {
              errMsg = errJson.message || errJson.error
            }
          } catch {
            // keep status error
          }
          throw new BadRequest(`Failed to fetch from remote URL: ${errMsg}`)
        }

        const json = (await res.json()) as any
        const data = json.data || json

        if (!data || typeof data !== "object") {
          throw new BadRequest(
            "Remote URL did not return valid IRIS export data"
          )
        }

        return {
          success: true,
          data,
        }
      } catch (err: any) {
        if (err?.status && err?.status >= 400) throw err
        throw new BadRequest(
          err?.message || "Could not connect to the remote IRIS URL"
        )
      }
    },
  },
})
