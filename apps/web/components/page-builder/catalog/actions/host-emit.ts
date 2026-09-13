import type { ActionCatalogItem } from "./types"

export const hostEmitAction: ActionCatalogItem = {
  id: "host-emit",
  name: "emit('eventName', payload)",
  category: "host",
  snippet: "emit('customEvent', { id: 123, status: 'completed' });",
  description: "Bridge event to host React component's onAction handler",
  keywords: ["emit", "host", "hook", "event", "dispatch", "parent", "react"],
}
