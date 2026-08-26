import { Elysia } from "elysia";
import { websocket } from "elysia/websocket";
import { bearer } from "@elysiajs/bearer";
import { prisma } from "@IRIS/database";
import { cors } from "./plugins";
import { createRouterModule } from "./router";

const PORT = Number(process.env.ELYSIA_PORT || 4000);

// Load all file-based routes
const routerModule = await createRouterModule();

// Clean API routes for client type generation (Eden Treaty)
export const routes = new Elysia()
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }))
  .use(routerModule);

// Full server application with database decoration, session derivation, websockets, and request logging
export const app = new Elysia()
  .decorate("prisma", prisma)
  .use(websocket())
  .use(cors())
  .afterResponse(({ request, set }) => {

    const startTime = (request as unknown as { _reqStartTime?: number })._reqStartTime;
    const duration = startTime ? (performance.now() - startTime).toFixed(1) : "0";
    const url = new URL(request.url);
    const status = set.status || 200;
    console.log(`[Elysia] ${request.method.padEnd(6)} ${url.pathname} -> ${status} (${duration}ms)`);
  })
  .use(bearer())
  .use(routes);

export type App = typeof routes;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[Elysia] server running at http://localhost:${PORT}`);
  });
}
