import { defineRoute } from "../../../../router"
import { getPublicAsset } from "../../../../utils/s3"

export default defineRoute({
  GET: {
    async handler({ params }) {
      const wildcardKey =
        (params as Record<string, string>)?.["*"] || (params as any)?.key || ""
      if (!wildcardKey) {
        return new Response(JSON.stringify({ error: "Not Found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })
      }

      const asset = await getPublicAsset(wildcardKey)
      if (!asset || !asset.body) {
        return new Response(
          JSON.stringify({ error: "File Not Found", key: wildcardKey }),
          {
            status: 404,
            headers: { "content-type": "application/json" },
          }
        )
      }

      // Convert AWS SDK Stream to Web ReadableStream if needed
      const stream = asset.body.transformToWebStream
        ? asset.body.transformToWebStream()
        : asset.body

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": asset.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
          ...(asset.contentLength
            ? { "Content-Length": String(asset.contentLength) }
            : {}),
        },
      })
    },
  },
})
