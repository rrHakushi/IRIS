import path from 'node:path'
import { getPublicAsset } from '../../utils/s3'
import { NotFound, BadRequest } from '../../lib/errors'

export class PublicAssetsServ {
  /**
   * MIME type lookup by file extension.
   */
  public static getContentType(key: string): string {
    const ext = path.extname(key).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.avif': 'image/avif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.txt': 'text/plain; charset=utf-8',
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  /**
   * Sanitize asset key to prevent path traversal vulnerabilities.
   */
  public static sanitizeKey(rawKey: string): string {
    if (!rawKey || typeof rawKey !== 'string') {
      throw new NotFound('Asset key cannot be empty')
    }

    const decoded = decodeURIComponent(rawKey).trim()

    if (
      decoded.includes('..') ||
      decoded.includes('\0') ||
      decoded.startsWith('/') ||
      decoded.startsWith('\\')
    ) {
      throw new BadRequest('Invalid asset path: directory traversal prohibited')
    }

    return decoded
  }

  /**
   * Serve a public asset by wildcard key from S3 / RustFS or local fallback storage.
   */
  public static async serveAsset(rawKey: string): Promise<Response> {
    const sanitizedKey = this.sanitizeKey(rawKey)

    // 1. Try S3 / RustFS
    try {
      const asset = await getPublicAsset(sanitizedKey)
      if (asset && asset.body) {
        const stream = asset.body.transformToWebStream
          ? asset.body.transformToWebStream()
          : asset.body

        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': asset.contentType || this.getContentType(sanitizedKey),
            'Cache-Control': 'public, max-age=31536000, immutable',
            ...(asset.contentLength
              ? { 'Content-Length': String(asset.contentLength) }
              : {}),
          },
        })
      }
    } catch {
      // Softly fall through to local fallback
    }

    // 2. Try Local File System Fallback
    const candidateDirs = [
      path.resolve(process.cwd(), 'uploads'),
      path.resolve(process.cwd(), 'public'),
      path.resolve(process.cwd(), '../../uploads'),
      path.resolve(process.cwd(), '../web/public'),
    ]

    for (const dir of candidateDirs) {
      const candidatePath = path.join(dir, sanitizedKey)
      // Safety check candidate stays within dir
      if (!candidatePath.startsWith(dir)) continue

      const file = Bun.file(candidatePath)
      if (await file.exists()) {
        const contentType = file.type || this.getContentType(sanitizedKey)
        return new Response(file, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Length': String(file.size),
          },
        })
      }
    }

    throw new NotFound(`File Not Found: ${sanitizedKey}`)
  }
}
