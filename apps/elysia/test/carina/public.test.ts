import { describe, expect, it, beforeEach, afterEach, afterAll } from 'bun:test'
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
const testFilePath = path.join(testUploadsDir, 'local-only-file.txt')

const app = new Elysia()
  .onError(({ error, set }) => {
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

describe('Comprehensive Carina Public Assets Test Suite (Strict RustFS)', () => {
  const originalSend = s3Client.send.bind(s3Client)

  beforeEach(() => {
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true })
    }
    fs.writeFileSync(testFilePath, 'I exist on local disk only!', 'utf-8')
  })

  afterEach(() => {
    ;(s3Client.send as any) = originalSend
  })

  afterAll(() => {
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath)
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

    it('fails (404) when requested asset does not exist in RustFS', async () => {
      ;(s3Client.send as any) = async () => {
        const err: any = new Error('NoSuchKey')
        err.name = 'NoSuchKey'
        err.$metadata = { httpStatusCode: 404 }
        throw err
      }

      const res = await app.handle(
        new Request('http://localhost/public/non-existent-image-12345.png', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('does NOT fallback to local filesystem even when file exists on disk (strict RustFS)', async () => {
      ;(s3Client.send as any) = async () => {
        const err: any = new Error('NoSuchKey')
        err.name = 'NoSuchKey'
        err.$metadata = { httpStatusCode: 404 }
        throw err
      }

      const res = await app.handle(
        new Request('http://localhost/public/local-only-file.txt', {
          method: 'GET',
        })
      )
      // Must strictly return 404 because file system fallback is disabled
      expect(res.status).toBe(404)
      const json = await res.json()
      expect(json.code).toBe('not-found')
    })

    it('successfully serves asset strictly from RustFS storage with proper headers', async () => {
      ;(s3Client.send as any) = async (command: any) => {
        if (command?.input?.Key === 'test-asset.txt') {
          return {
            Body: new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('Hello from RustFS storage!'))
                controller.close()
              },
            }),
            ContentType: 'text/plain; charset=utf-8',
            ContentLength: 26,
          }
        }
        throw new Error('Not found')
      }

      const res = await app.handle(
        new Request('http://localhost/public/test-asset.txt', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('Hello from RustFS storage!')
      expect(res.headers.get('content-type')).toContain('text/plain')
      expect(res.headers.get('content-length')).toBe('26')
      expect(res.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable'
      )
    })

    it('serves image files from RustFS with correct MIME type detection', async () => {
      ;(s3Client.send as any) = async (command: any) => {
        if (command?.input?.Key === 'avatar.png') {
          return {
            Body: new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
                controller.close()
              },
            }),
            ContentType: 'image/png',
            ContentLength: 4,
          }
        }
        throw new Error('Not found')
      }

      const res = await app.handle(
        new Request('http://localhost/public/avatar.png', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('image/png')
      expect(res.headers.get('content-length')).toBe('4')
      expect(res.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable'
      )
    })

    it('serves S3 asset when present in S3 storage', async () => {
      ;(s3Client.send as any) = async (command: any) => {
        if (command?.input?.Key === 'users/1/avatar.webp') {
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
        throw new Error('Not found')
      }

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
    })
  })

  // ===========================================================================
  // 2. GET /carina/public/* (Carina namespace alias)
  // ===========================================================================
  describe('GET /carina/public/*', () => {
    it('serves the same asset under /carina/public/* from RustFS', async () => {
      ;(s3Client.send as any) = async (command: any) => {
        if (command?.input?.Key === 'test-asset.txt') {
          return {
            Body: new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('Hello from RustFS storage!'))
                controller.close()
              },
            }),
            ContentType: 'text/plain; charset=utf-8',
            ContentLength: 26,
          }
        }
        throw new Error('Not found')
      }

      const res = await app.handle(
        new Request('http://localhost/carina/public/test-asset.txt', {
          method: 'GET',
        })
      )
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('Hello from RustFS storage!')
    })

    it('fails (404) on non-existent file under /carina/public/*', async () => {
      ;(s3Client.send as any) = async () => {
        const err: any = new Error('NoSuchKey')
        err.name = 'NoSuchKey'
        err.$metadata = { httpStatusCode: 404 }
        throw err
      }

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
