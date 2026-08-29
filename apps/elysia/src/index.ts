import fs from "node:fs"
import path from "node:path"
import { Elysia } from "elysia"
import { websocket } from "elysia/websocket"
import { prisma } from "@IRIS/database"
import { cache } from "./utils/cache"
import { cors, cron, rateLimiter, session } from "./plugins"
import { resolveSessionFromRequest } from "./plugins/session"
import { wsHub } from "./services/websocket-hub"
import { createRouterModule } from "./router"
import { routes } from "./router/routes.generated"
import { c, colorMethod, colorStatus, colorDuration } from "./utils/colors"
import {
  initConsoleInterceptor,
  printGroupedRequestLogs,
  type RequestLogItem,
} from "./utils/request-logger"

// Intercept console inside request handlers to group logs by request
initConsoleInterceptor()

const PORT = Number(process.env.ELYSIA_PORT || 4000)

// Automatically generate Eden routes and watch modules in development
await createRouterModule()

export { routes }
export type App = typeof routes
export * from "./plugins/cron"

declare module "elysia" {
  export const ELYSIA_FORM_DATA: unique symbol
}

const loadedPlugins: string[] = []

function loadPlugin<T>(name: string, plugin: T, description?: string): T {
  loadedPlugins.push(name)
  const desc = description ? c.dim(` (${description})`) : ""
  console.log(
    `${c.yellow(c.bold("[Plugins]"))} Plugin loaded: ${c.cyan(name.padEnd(10))}${desc}`
  )
  return plugin
}

// Full server application with database decoration, session derivation, websockets, request logging, and task scheduling
export const app = new Elysia()
  .decorate("prisma", prisma)
  .decorate("cache", cache)
  .use(loadPlugin("websocket", websocket(), "realtime websocket transport"))
  .use(loadPlugin("cors", cors(), "cross-origin resource sharing"))
  .use(loadPlugin("session", session(), "multi-source session resolver"))
  .use(loadPlugin("rateLimiter", rateLimiter(), "in-memory ip rate limiting"))
  .use(loadPlugin("cron", cron(), "in-memory task scheduler"))
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
    const resp = (ctx as any).responseValue ?? (ctx as any).response
    const status =
      (resp instanceof Response
        ? resp.status
        : typeof (resp as any)?.status === "number"
          ? (resp as any).status
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
    async open(ws: any) {
      const request = ws?.data?.request ?? ws?.raw?.request
      const sessionUser = ws?.data?.session?.user
      let userId: string | null =
        sessionUser?.id ??
        ws?.data?.query?.userId ??
        (ws as any)?.query?.userId ??
        null

      if (!userId) {
        const rawUrl =
          typeof request?.url === "string"
            ? request.url
            : typeof (ws as any)?.url === "string"
              ? (ws as any).url
              : typeof (ws?.raw as any)?.url === "string"
                ? (ws.raw as any).url
                : ""
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
        console.log(
          `${c.magenta(c.bold("[WebSocket]"))} ${c.green("Client connected:")} user=${c.cyan(userId)}`
        )
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
        ;(ws as any)._authTimeout = authTimeout
      }
    },
    message(ws: any, message) {
      wsHub.handleMessage(ws, message)
    },
    close(ws: any) {
      if ((ws as any)._authTimeout) {
        clearTimeout((ws as any)._authTimeout)
      }
      const hadUser = wsHub.hasConnection(ws)
      wsHub.unregister(ws)
      if (hadUser) {
        console.log(
          `${c.magenta(c.bold("[WebSocket]"))} ${c.yellow("Client disconnected")}`
        )
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

console.log(
  `${c.yellow(c.bold("[Plugins]"))} Total plugins loaded: ${c.green(loadedPlugins.length)}`
)

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
