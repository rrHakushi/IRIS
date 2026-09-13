import type { ActionCatalogItem } from "./types"

export const themeSetAction: ActionCatalogItem = {
  id: "theme-dark",
  name: "theme.setTheme('dark')",
  category: "theme",
  snippet: "theme.setTheme('dark');",
  description: "Switch active app theme to dark mode",
  keywords: ["theme", "dark", "mode", "night"],
}
