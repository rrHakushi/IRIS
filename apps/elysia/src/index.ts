import fs from "node:fs"
import path from "node:path"
import { Elysia } from "elysia"
import { websocket } from "elysia/websocket"
import type { ElysiaWS } from "elysia/ws"
import { prisma } from "@IRIS/database"
import { cache } from "./utils/cache"
import { cors, cron, notificationPlugin, rateLimiter, session } from "./plugins"
import { resolveSessionFromRequest } from "./plugins/session"
import { wsHub, initServices } from "./services"
import { createRouterModule } from "./router"
import { routes } from "./router/generated/routes.generated"
import { c, colorMethod, colorStatus, colorDuration } from "./utils/colors"
import { logger } from "./utils/logger"
import {
  initConsoleInterceptor,
  printGroupedRequestLogs,
  type RequestLogItem,
} from "./utils/request-logger"

// Intercept console inside request handlers to group logs by request
initConsoleInterceptor()

declare global {
  interface BigInt {
    toJSON(): number | string
  }
}

// Enable native JSON serialization for BigInt values returned by database queries
BigInt.prototype.toJSON = function () {
  const intVal = Number(this)
  return Number.isSafeInteger(intVal) ? intVal : this.toString()
}

const PORT = Number(process.env.ELYSIA_PORT || 4000)

// Automatically generate Eden routes and watch modules in development
await createRouterModule()

export { routes }
export type App = typeof routes
export * from "./plugins/cron"
export type { AnimeDetails } from "./modules/IRIS-media/media/anime/[id]/route"
export type { MovieDetails } from "./modules/IRIS-media/media/movies/[id]/route"
export type { TvDetails } from "./modules/IRIS-media/media/tv/[id]/route"
export type { MangaDetails } from "./modules/IRIS-media/media/manga/[id]/route"
export type { GameDetails } from "./modules/IRIS-media/media/games/[id]/route"
export type { BookDetails } from "./modules/IRIS-media/media/books/[id]/route"
export type { CharacterDetails } from "./modules/IRIS-media/media/characters/[id]/route"
export type { PersonDetails } from "./modules/IRIS-media/media/people/[id]/route"
export type { SimilarMediaItem } from "./modules/IRIS-media/helpers/media-similarity"

declare module "elysia" {
  export const ELYSIA_FORM_DATA: unique symbol
}

const loadedPlugins: string[] = []

function loadPlugin<T>(name: string, plugin: T, description?: string): T {
  loadedPlugins.push(name)
  logger.plugin.loaded(name, description)
  return plugin
}

const authTimeouts = new WeakMap<object, ReturnType<typeof setTimeout>>()

// Full server application with database decoration, session derivation, websockets, request logging, and task scheduling
export const app = new Elysia()
  .decorate("prisma", prisma)
  .decorate("cache", cache)
  .use(loadPlugin("websocket", websocket(), "realtime websocket transport"))
  .use(loadPlugin("cors", cors(), "cross-origin resource sharing"))
  .use(loadPlugin("session", session(), "multi-source session resolver"))
  .use(loadPlugin("rateLimiter", rateLimiter(), "in-memory ip rate limiting"))
  .use(loadPlugin("cron", cron(), "in-memory task scheduler"))
  .use(
    loadPlugin(
      "notifications",
      notificationPlugin(),
      "post-quantum encrypted notification dispatcher"
    )
  )
  .request(({ request }) => {
    ;(request as unknown as { _reqStartTime?: number })._reqStartTime =
      performance.now()
  })
  .afterResponse("global", (ctx) => {
    const { request, set } = ctx
    const startTime = (request as unknown as { _reqStartTime?: number })
      ._reqStartTime
    const durationMs = startTime ? performance.now() - startTime : 0
    const url = new URL(request.url)
    const ctxObj = ctx as Record<string, unknown>
    const resp = ctxObj.responseValue ?? ctxObj.response
    const respObj =
      typeof resp === "object" && resp !== null
        ? (resp as Record<string, unknown>)
        : null
    const status =
      (resp instanceof Response
        ? resp.status
        : typeof respObj?.status === "number"
          ? (respObj.status as number)
          : typeof set.status === "number"
            ? set.status
            : 200) || 200

    const isWs =
      url.pathname === "/ws" ||
      request.headers.get("upgrade")?.toLowerCase() === "websocket"

    if (isWs) return

    const tag = c.magenta(c.bold("[Elysia]"))
    const method = colorMethod(request.method)
    const path = c.cyan(url.pathname)
    const arrow = c.gray("->")
    const statusColored = colorStatus(status)
    const time = ` ${colorDuration(durationMs)}`

    process.stdout.write(
      `${tag} ${method} ${path} ${arrow} ${statusColored}${time}\n`
    )

    const logs =
      (request as unknown as { _requestLogs?: RequestLogItem[] })
        ._requestLogs || []
    printGroupedRequestLogs(logs)
  })
  .ws("/ws", {
    async open(ws) {
      const request = ws.request
      const sessionUser = ws.session?.user
      let userId: string | null = sessionUser?.id ?? ws.query?.userId ?? null

      if (!userId) {
        const rawUrl = typeof request?.url === "string" ? request.url : ""
        if (rawUrl) {
          try {
            const parsedUrl = new URL(rawUrl, "http://localhost:4000")
            const queryUserId = parsedUrl.searchParams.get("userId")
            if (queryUserId && queryUserId.trim()) {
              userId = queryUserId.trim()
            }
          } catch {
            // ignore
          }
        }
      }

      if (!userId && request) {
        try {
          const { sessionData } = await resolveSessionFromRequest(
            request,
            prisma
          )
          userId = sessionData?.user?.id ?? null
        } catch {
          // ignore
        }
      }

      if (userId) {
        wsHub.register(ws, userId)
        logger.ws.connected(userId)
        wsHub.send(ws, "auth:success", { userId })
      } else {
        // Allow a 5-second grace period for client to authenticate via auth frame
        const authTimeout = setTimeout(() => {
          if (!wsHub.hasConnection(ws)) {
            try {
              ws.close(4401, "Unauthorized")
            } catch {
              // ignore
            }
          }
        }, 5000)
        authTimeouts.set(ws, authTimeout)
      }
    },
    message(ws, message) {
      wsHub.handleMessage(ws, message)
    },
    close(ws) {
      const authTimeout = authTimeouts.get(ws)
      if (authTimeout) {
        clearTimeout(authTimeout)
        authTimeouts.delete(ws)
      }
      const hadUser = wsHub.hasConnection(ws)
      wsHub.unregister(ws)
      if (hadUser) {
        logger.ws.disconnected()
      }
    },
  })
  .use(routes)

const isDev = process.env.NODE_ENV === "development"

if (isDev) {
  const getInsomniumConfig = () => {
    const configPath = path.resolve(import.meta.dirname, "../insomnium.json")
    if (fs.existsSync(configPath)) {
      return new Response(fs.readFileSync(configPath, "utf-8"), {
        headers: { "content-type": "application/json" },
      })
    }
    return new Response(
      JSON.stringify({ error: "insomnium.json not generated" }),
      {
        status: 404,
        headers: { "content-type": "application/json" },
      }
    )
  }

  app.get("/insomnium.json", getInsomniumConfig)
  app.get("/insomnia.json", getInsomniumConfig)
}

logger.plugin.total(loadedPlugins.length)

initServices()

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(
      `${c.magenta(c.bold("[Elysia]"))} ${c.green("server running at")} ${c.cyan(c.underline(`http://localhost:${PORT}`))}`
    )
    if (isDev) {
      console.log(
        `${c.cyan(c.bold("[Insomnium]"))} ${c.dim("Collection URL:")} ${c.cyan(c.underline(`http://localhost:${PORT}/insomnium.json`))}`
      )
    }
  })
}
