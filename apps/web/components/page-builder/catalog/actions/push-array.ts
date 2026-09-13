import type { ActionCatalogItem } from "./types"

export const pushArrayAction: ActionCatalogItem = {
  id: "push-array",
  name: "push('arrayPath', item)",
  category: "state",
  snippet: "push('items', { id: Date.now(), title: 'New Item' });",
  description: "Append an item to an array in reactive state",
  keywords: ["push", "array", "add", "append", "list", "item"],
}
