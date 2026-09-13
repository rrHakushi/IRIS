import type { ComponentPresetItem } from "./types"

export const typographyPresets: ComponentPresetItem[] = [
  {
    id: "typo-heading-1",
    name: "Heading 1",
    category: "typography",
    icon: "IconHeading",
    description: "Large page section headline",
    getNode: () => ({
      type: "h1",
      props: { className: "text-3xl font-bold font-heading tracking-tight" },
      children: "Headline Title",
    }),
  },
  {
    id: "typo-heading-2",
    name: "Heading 2",
    category: "typography",
    icon: "IconHeading",
    description: "Secondary section headline",
    getNode: () => ({
      type: "h2",
      props: { className: "text-2xl font-semibold tracking-tight" },
      children: "Section Title",
    }),
  },
  {
    id: "typo-paragraph",
    name: "Paragraph",
    category: "typography",
    icon: "IconTypography",
    description: "Standard body text block",
    getNode: () => ({
      type: "p",
      props: { className: "text-sm text-muted-foreground leading-relaxed" },
      children: "Start typing your content here or connect dynamic state expressions.",
    }),
  },
  {
    id: "typo-badge",
    name: "Badge",
    category: "typography",
    icon: "IconSparkles",
    description: "Status indicator or pill tag",
    getNode: () => ({
      type: "Badge",
      props: { variant: "secondary" },
      children: "Active Tag",
    }),
  },
]
