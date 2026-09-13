import type { ActionCatalogItem } from "./types"

export const elysiaPostAction: ActionCatalogItem = {
  id: "elysia-post",
  name: "await elysia.<route>.post()",
  category: "elysia",
  snippet: "const res = await elysia.items.post({ title: state.inputVal });\nif (res.error) toast.error(res.error.value);\nelse toast.success('Created successfully!');",
  description: "Call an Elysia backend POST endpoint with payload",
  keywords: ["elysia", "api", "post", "create", "backend", "send", "mutation"],
}
