import type { ActionCatalogItem } from "./types"

export const toastInfoAction: ActionCatalogItem = {
  id: "toast-info",
  name: "toast.info(message)",
  category: "toast",
  snippet: "toast.info('Item moved to processing queue.');",
  description: "Display a blue informational toast notification",
  keywords: ["toast", "info", "notice", "alert", "log"],
}
