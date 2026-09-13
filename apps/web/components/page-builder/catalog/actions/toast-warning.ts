import type { ActionCatalogItem } from "./types"

export const toastWarningAction: ActionCatalogItem = {
  id: "toast-warning",
  name: "toast.warning(message)",
  category: "toast",
  snippet: "toast.warning('Please review required fields.');",
  description: "Display an amber warning toast notification",
  keywords: ["toast", "warning", "caution", "alert", "validate"],
}
