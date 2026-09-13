import type { ActionCatalogItem } from "./types"

export const helperNumberAction: ActionCatalogItem = {
  id: "helper-number",
  name: "helpers.formatNumber(number)",
  category: "host",
  snippet: "toast.info('Total count: ' + helpers.formatNumber(1250000));",
  description: "Format large numbers with thousands separators",
  keywords: ["helper", "number", "format", "comma", "currency", "count"],
}
