import { describe, expect, it, beforeEach, afterAll } from 'bun:test'
import { Elysia, ValidationError } from 'elysia'
import { carinaPublic } from '../../src/api/controllers/carina/public.ctrl'
import { isHttpError } from '../../src/lib/errors'
import { s3Client } from '../../src/utils/s3'
import path from 'node:path'
import fs from 'node:fs'

// -----------------------------------------------------------------------------
// Test Setup & Mocking
// -----------------------------------------------------------------------------

const testUploadsDir = path.resolve(process.cwd(), 'uploads')
const testFilePath = path.join(testUploadsDir, 'test-asset.txt')
const testImagePath = path.join(testUploadsDir, 'avatar.png')

const app = new Elysia()
  .error(({ error, set }) => {
    if (isHttpError(error)) {
      set.status = error.status
      return error.toResponse()
    }
    if (error instanceof ValidationError) {
      set.status = 422
      return {
        type: 'validation',
        title: 'Unprocessable Content',
        status: 422,
        code: 'validation',
        detail: error.message,
      }
    }
  })
  .use(carinaPublic)

describe('Comprehensive Carina Public Assets Test Suite', () => {
  beforeEach(() => {
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true })
    }
    fs.writeFileSync(testFilePath, 'Hello from local public uploads!', 'utf-8')
    fs.writeFileSync(testImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) // PNG magic bytes
  })

  afterAll(() => {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath)
    if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath)
  })

  // ===========================================================================
  // 1. GET /public/* (Serve static / public uploaded files)
  // ===========================================================================
  describe('GET /public/*', () => {
    it('fails (400) when path traversal is attempted with encoded .. (%2E%2E%2F)', async () => {
      const res = await app.handle(
        new Request('http://localhost/public/folder/%2E%2E%2Fsecret.env', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
      expect(json.detail).toContain('directory traversal prohibited')
    })

    it('fails (400) when path traversal is encoded (%2E%2E)', async () => {
      const res = await app.handle(
        new Request('http://localhost/public/%2E%2E%2Fsecret.env', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.code).toBe('bad-request')
    })

    it('fails (404) when requested asset does not exist', async () => {
      const res = await app.handle(
        new Request('http://localhost/public/non-existent-image-12345.png', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('successfully serves asset from local disk fallback with proper headers', async () => {
      const res = await app.handle(
        new Request('http://localhost/public/test-asset.txt', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('Hello from local public uploads!')
      expect(res.headers.get('content-type')).toContain('text/plain')
      expect(res.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable'
      )
    })

    it('serves image files with correct MIME type detection', async () => {
      const res = await app.handle(
        new Request('http://localhost/public/avatar.png', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(res.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable'
      )
    })

    it('serves S3 asset when present in S3 storage', async () => {
      // Mock s3Client.send for GetObjectCommand
      const originalSend = s3Client.send.bind(s3Client)
      ;(s3Client.send as any) = async (command: any) => {
        if (command?.constructor?.name === 'GetObjectCommand' || command?.input?.Key === 'users/1/avatar.webp') {
          return {
            Body: new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('mocked-s3-binary-stream'))
                controller.close()
              },
            }),
            ContentType: 'image/webp',
            ContentLength: 22,
          }
        }
        return originalSend(command)
      }

      try {
        const res = await app.handle(
          new Request('http://localhost/public/users/1/avatar.webp', {
            method: 'GET',
          })
        )
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe('image/webp')
        expect(res.headers.get('content-length')).toBe('22')
        expect(res.headers.get('cache-control')).toBe(
          'public, max-age=31536000, immutable'
        )
        const text = await res.text()
        expect(text).toBe('mocked-s3-binary-stream')
      } finally {
        ;(s3Client.send as any) = originalSend
      }
    })
  })

  // ===========================================================================
  // 2. GET /carina/public/* (Carina namespace alias)
  // ===========================================================================
  describe('GET /carina/public/*', () => {
    it('serves the same asset under /carina/public/*', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/public/test-asset.txt', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('Hello from local public uploads!')
    })

    it('fails (404) on non-existent file under /carina/public/*', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/public/missing.jpg', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(404)
    })

    it('fails (400) on directory traversal under /carina/public/*', async () => {
      const res = await app.handle(
        new Request('http://localhost/carina/public/folder/%2E%2E%2Fsecret.env', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(400)
    })
  })
})
