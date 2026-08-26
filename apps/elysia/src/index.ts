import { Elysia } from "elysia";
import { websocket } from "elysia/websocket";
import { bearer } from "@elysiajs/bearer";
import { prisma } from "@IRIS/database";
import { cors } from "./plugins";
import { createRouterModule, routes } from "./router";
import { c, colorMethod, colorStatus, colorDuration } from "./utils/colors";

const PORT = Number(process.env.ELYSIA_PORT || 4000);

// Automatically generate Eden routes and watch modules in development
await createRouterModule();

export { routes };
export type App = typeof routes;

// Full server application with database decoration, session derivation, websockets, and request logging
export const app = new Elysia()
  .decorate("prisma", prisma)
  .use(websocket())
  .use(cors())
  .request(({ request }) => {
    (request as unknown as { _reqStartTime?: number })._reqStartTime = performance.now();
  })
  .afterResponse(({ request, set }) => {
    const startTime = (request as unknown as { _reqStartTime?: number })._reqStartTime;
    const durationMs = startTime ? performance.now() - startTime : 0;
    const url = new URL(request.url);
    const status = set.status || 200;

    const tag = c.magenta(c.bold("[Elysia]"));
    const method = colorMethod(request.method);
    const path = c.cyan(url.pathname);
    const arrow = c.gray("->");
    const statusColored = colorStatus(status);
    const time = colorDuration(durationMs);

    console.log(`${tag} ${method} ${path} ${arrow} ${statusColored} ${time}`);
  })
  .use(bearer())
  .use(routes);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(
      `${c.magenta(c.bold("[Elysia]"))} ${c.green("server running at")} ${c.cyan(c.underline(`http://localhost:${PORT}`))}`
    );
  });
}
