import type { ComponentPresetItem } from "./types"

export const blockPresets: ComponentPresetItem[] = [
  {
    id: "block-card",
    name: "Card Container",
    category: "blocks",
    icon: "IconCreditCard",
    description: "Surface card with header, title, and content",
    getNode: () => ({
      type: "Card",
      children: [
        {
          type: "CardHeader",
          children: [
            { type: "CardTitle", children: "Card Title" },
            { type: "CardDescription", children: "Card description text." },
          ],
        },
        { type: "CardContent", children: [{ type: "p", children: "Card body content goes here." }] },
      ],
    }),
  },
  {
    id: "block-flex-row",
    name: "Flex Row",
    category: "blocks",
    icon: "IconLayoutRows",
    description: "Horizontal flex container with gap spacing",
    getNode: () => ({
      type: "div",
      props: { className: "flex items-center justify-between gap-4 p-4 rounded-2xl border bg-card" },
      children: [],
    }),
  },
  {
    id: "block-empty-div",
    name: "Layout Item / Slot",
    category: "blocks",
    icon: "IconBoxPadding",
    description: "Empty layout container ready for child elements",
    getNode: () => ({
      type: "div",
      props: { className: "w-full p-4 rounded-2xl border border-dashed border-border/80 min-h-24" },
      children: [],
    }),
  },
]
