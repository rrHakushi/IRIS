import type { ActionCatalogItem } from "./types"

export const removeArrayAction: ActionCatalogItem = {
  id: "remove-array",
  name: "remove('arrayPath', index)",
  category: "state",
  snippet: "remove('items', 0);",
  description: "Remove an item by index from an array in reactive state",
  keywords: ["remove", "delete", "array", "item", "pop", "filter"],
}
