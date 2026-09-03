import { defineRoute, t } from "../../../../../router"
import {
  uploadPublicAsset,
  deletePublicAsset,
  extractS3Key,
} from "../../../../../utils/s3"
import { getProfileCustomization } from "@IRIS/shared"

export default defineRoute({
  POST: {
    schema: {
      body: t.Object({
        file: t.File(),
        assetType: t.Union([
          t.Literal("avatar"),
          t.Literal("banner"),
          t.Literal("nameplate"),
          t.Literal("sidebarBanner"),
          t.Literal("avatarFrame"),
        ]),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
          url: t.String(),
          key: t.String(),
          assetType: t.String(),
        }),
      },
    },
    async handler({ body, session, prisma }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Session expired" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        )
      }

      const { file, assetType } = body

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
      ]

      if (!allowedTypes.includes(file.type)) {
        return new Response(
          JSON.stringify({
            error: "Bad Request",
            message:
              "Unsupported file format. Please upload JPEG, PNG, WebP, GIF, or SVG.",
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        )
      }

      // Max size: 10MB
      const maxSizeBytes = 10 * 1024 * 1024
      if (file.size > maxSizeBytes) {
        return new Response(
          JSON.stringify({
            error: "Bad Request",
            message: "File size exceeds 10MB limit.",
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        )
      }

      // Automatically clean up previously stored asset of this type from RustFS
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            customization: true,
          },
        })

        if (user) {
          const profile = getProfileCustomization(user.customization)
          let oldUrl: string | null | undefined = null

          if (assetType === "avatar") {
            oldUrl = profile.avatarUrl
          } else if (assetType === "banner") {
            oldUrl = profile.bannerUrl
          } else if (
            assetType === "nameplate" ||
            assetType === "sidebarBanner"
          ) {
            oldUrl = profile.nameplateUrl || profile.sidebarBannerUrl
          } else if (assetType === "avatarFrame") {
            oldUrl = profile.avatarFrame
          }

          if (oldUrl) {
            const oldKey = extractS3Key(oldUrl)
            if (oldKey && oldKey.startsWith(`users/${session.user.id}/`)) {
              await deletePublicAsset(oldKey)
            }
          }
        }
      } catch (cleanupErr) {
        console.warn("[Assets] Warning during old asset cleanup:", cleanupErr)
      }

      let ext = "png"
      if (file.type === "image/jpeg") ext = "jpg"
      else if (file.type === "image/webp") ext = "webp"
      else if (file.type === "image/gif") ext = "gif"
      else if (file.type === "image/svg+xml") ext = "svg"

      const key = `users/${session.user.id}/${assetType}-${Date.now()}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      try {
        const { publicUrl } = await uploadPublicAsset({
          key,
          body: buffer,
          contentType: file.type,
        })

        return {
          success: true,
          url: publicUrl,
          key,
          assetType,
        }
      } catch (err: any) {
        console.error("[Assets] Upload failed:", err)
        return new Response(
          JSON.stringify({
            error: "Internal Server Error",
            message: err?.message || "Failed to upload file to storage.",
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          }
        )
      }
    },
  },

  DELETE: {
    schema: {
      body: t.Object({
        key: t.String(),
      }),
      response: {
        200: t.Object({
          success: t.Boolean(),
        }),
      },
    },
    async handler({ body, session }) {
      if (!session.isAuthenticated || !session.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", message: "Session expired" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          }
        )
      }

      const targetKey = extractS3Key(body.key) || body.key

      // Ensure key belongs to current user
      if (!targetKey.startsWith(`users/${session.user.id}/`)) {
        return new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Cannot delete another user's asset",
          }),
          {
            status: 403,
            headers: { "content-type": "application/json" },
          }
        )
      }

      const success = await deletePublicAsset(targetKey)
      return { success }
    },
  },
})
