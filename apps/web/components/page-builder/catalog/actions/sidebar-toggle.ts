import type { ActionCatalogItem } from "./types"

export const sidebarToggleAction: ActionCatalogItem = {
  id: "sidebar-toggle",
  name: "sidebar.toggleSidebar()",
  category: "navigation",
  snippet: "sidebar.toggleSidebar();",
  description: "Collapse or expand the application sidebar",
  keywords: ["sidebar", "navigation", "toggle", "menu", "drawer", "collapse"],
}
