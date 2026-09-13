export interface ActionCatalogItem {
  id: string
  name: string
  category: "state" | "toast" | "elysia" | "theme" | "navigation" | "host"
  snippet: string
  description: string
  keywords: string[]
}
