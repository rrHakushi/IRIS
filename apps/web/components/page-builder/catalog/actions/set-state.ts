import type { ActionCatalogItem } from "./types"

export const setStateAction: ActionCatalogItem = {
  id: "set-state",
  name: "set('path', value)",
  category: "state",
  snippet: "set('counter', state.counter + 1);",
  description: "Update a variable in reactive page state",
  keywords: ["set", "state", "update", "variable", "change", "mutate"],
}
