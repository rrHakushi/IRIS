import type { ActionCatalogItem } from "./types"

export const toggleStateAction: ActionCatalogItem = {
  id: "toggle-state",
  name: "toggle('path')",
  category: "state",
  snippet: "toggle('isOpen');",
  description: "Flip a boolean state variable between true/false",
  keywords: ["toggle", "boolean", "switch", "state", "open", "close", "flip"],
}
