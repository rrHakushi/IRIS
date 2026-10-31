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
   * Serve a public asset strictly from RustFS (S3 storage).
   * No fallback to local file system.
   */
  public static async serveAsset(rawKey: string): Promise<Response> {
    const sanitizedKey = this.sanitizeKey(rawKey)

    const asset = await getPublicAsset(sanitizedKey)
    if (!asset || !asset.body) {
      throw new NotFound(`File Not Found: ${sanitizedKey}`)
    }

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
}
