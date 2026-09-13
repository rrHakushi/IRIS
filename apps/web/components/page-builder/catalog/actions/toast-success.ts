import type { ActionCatalogItem } from "./types"

export const toastSuccessAction: ActionCatalogItem = {
  id: "toast-success",
  name: "toast.success(message)",
  category: "toast",
  snippet: "toast.success('Changes saved successfully!');",
  description: "Display an emerald success toast notification",
  keywords: ["toast", "success", "notify", "message", "alert", "done"],
}
