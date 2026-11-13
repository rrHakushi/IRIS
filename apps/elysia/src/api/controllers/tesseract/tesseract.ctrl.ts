import { Elysia } from 'elysia'
import { session } from '../../../plugins/session'
import { Unauthorized } from '../../../lib/errors'
import { TesseractModel } from '../../models/tesseract/tesseract.model'
import { tesseractServ } from '../../../services/tesseract/tesseract.serv'

export const tesseractController = new Elysia({ prefix: '/tesseract' })
  .use(session())

  // --- 1. GET /tesseract/identity ---
  .get(
    '/identity',
    {
      detail: {
        summary: 'Get Tesseract LAN lobby scope and optional authenticated user profile',
        tags: ['Tesseract'],
      },
      response: {
        200: TesseractModel.identityResponse,
      },
    },
    async ({ request, server }) => {
      const remoteAddr = (server as any)?.requestIP?.(request)?.address ?? null
      return await tesseractServ.getIdentity(request, remoteAddr)
    }
  )

  // --- 2. GET /tesseract/events (SSE fallback when WS upgrade is unavailable) ---
  .get(
    '/events',
    {
      query: TesseractModel.eventsQuery,
      detail: {
        summary: 'Server-Sent Events signaling fallback stream for Tesseract',
        tags: ['Tesseract'],
      },
    },
    async ({ query, request, server }) => {
      const remoteAddr = (server as any)?.requestIP?.(request)?.address ?? null
      const encoder = new TextEncoder()
      let peerId: string | null = null
      let closed = false
      let keepAliveTimer: ReturnType<typeof setInterval> | null = null

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const cleanup = async () => {
            if (closed) return
            closed = true
            if (keepAliveTimer) {
              clearInterval(keepAliveTimer)
              keepAliveTimer = null
            }
            if (peerId) {
              const id = peerId
              peerId = null
              await tesseractServ.disconnectPeer(id)
            }
            try {
              controller.close()
            } catch {}
          }

          request.signal.addEventListener('abort', () => {
            void cleanup()
          })

          const result = await tesseractServ.connectPeer({
            transport: {
              send: (serialized: string) => {
                if (closed) return
                try {
                  controller.enqueue(encoder.encode(`data: ${serialized}\n\n`))
                } catch {}
              },
              close: () => {
                void cleanup()
              },
            },
            request,
            remoteAddress: remoteAddr,
            deviceId: query.deviceId,
            tabId: query.tabId,
            alias: query.alias,
            deviceType: query.deviceType,
            os: query.os,
            browser: query.browser,
            requireShelfApproval: query.approval === 'true',
            issueSseSecret: true,
            isAborted: () => closed || request.signal.aborted,
          })

          if (!result) return
          peerId = result.peerId

          keepAliveTimer = setInterval(() => {
            if (closed) return
            try {
              controller.enqueue(encoder.encode(': keepalive\n\n'))
            } catch {
              void cleanup()
            }
          }, 15_000)
        },
        async cancel() {
          if (closed) return
          closed = true
          if (keepAliveTimer) {
            clearInterval(keepAliveTimer)
            keepAliveTimer = null
          }
          if (peerId) {
            const id = peerId
            peerId = null
            await tesseractServ.disconnectPeer(id)
          }
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }
  )

  // --- 5. POST /tesseract/signal (HTTP signaling companion for SSE fallback) ---
  .post(
    '/signal',
    {
      body: TesseractModel.signalBody,
      detail: {
        summary: 'Send a Tesseract signaling frame when using SSE fallback transport',
        tags: ['Tesseract'],
      },
      response: {
        200: TesseractModel.signalResponse,
        401: TesseractModel.unauthorizedError,
        422: TesseractModel.validationError,
      },
    },
    async ({ body }) => {
      const allowed = await tesseractServ.verifySseSignalAccess(
        body.peerId,
        body.sseSecret
      )
      if (!allowed) {
        throw new Unauthorized('Invalid Tesseract peer credentials')
      }
      await tesseractServ.handleClientSignal(body.peerId, body.payload)
      return { ok: true }
    }
  )

export default tesseractController

