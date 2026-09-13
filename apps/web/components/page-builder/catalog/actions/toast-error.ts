import type { ActionCatalogItem } from "./types"

export const toastErrorAction: ActionCatalogItem = {
  id: "toast-error",
  name: "toast.error(message)",
  category: "toast",
  snippet: "toast.error('Operation failed. Please try again.');",
  description: "Display a red error toast notification",
  keywords: ["toast", "error", "fail", "danger", "alert", "catch"],
}
