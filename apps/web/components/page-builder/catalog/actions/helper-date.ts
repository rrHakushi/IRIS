import type { ActionCatalogItem } from "./types"

export const helperDateAction: ActionCatalogItem = {
  id: "helper-date",
  name: "helpers.formatDate(date)",
  category: "host",
  snippet: "toast.info('Current date: ' + helpers.formatDate(Date.now()));",
  description: "Format timestamp according to local user preferences",
  keywords: ["helper", "date", "format", "time", "day", "calendar"],
}
