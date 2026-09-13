import type { ActionCatalogItem } from "./types"

export const themeToggleAction: ActionCatalogItem = {
  id: "theme-toggle",
  name: "theme.setTheme(toggle)",
  category: "theme",
  snippet: "theme.setTheme(theme.resolvedTheme === 'dark' ? 'light' : 'dark');",
  description: "Toggle app theme between light and dark mode",
  keywords: ["theme", "dark", "light", "mode", "toggle", "color"],
}
