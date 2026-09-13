import type { ActionCatalogItem } from "./types"

export const elysiaGetAction: ActionCatalogItem = {
  id: "elysia-get",
  name: "await elysia.<route>.get()",
  category: "elysia",
  snippet: "const res = await elysia.auth.me.get();\ntoast.info('User: ' + res.data?.user?.username);",
  description: "Call an Elysia backend GET endpoint via Eden Treaty",
  keywords: ["elysia", "api", "fetch", "get", "backend", "eden", "treaty", "auth"],
}
