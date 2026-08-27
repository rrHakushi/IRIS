import fs from "node:fs"
import path from "node:path"
import { Elysia } from "elysia"
import { websocket } from "elysia/websocket"
import { prisma } from "@IRIS/database"
import { cache } from "./utils/cache"
import { cors, cron, rateLimiter, session } from "./plugins"
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

    const tag = c.magenta(c.bold("[Elysia]"))
    const method = colorMethod(request.method)
    const path = c.cyan(url.pathname)
    const arrow = c.gray("->")
    const statusColored = colorStatus(status)
    const time = colorDuration(durationMs)

    process.stdout.write(
      `${tag} ${method} ${path} ${arrow} ${statusColored} ${time}\n`
    )

    const logs =
      (request as unknown as { _requestLogs?: RequestLogItem[] })
        ._requestLogs || []
    printGroupedRequestLogs(logs)
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
