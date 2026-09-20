import type { ComponentPresetItem } from "./types"

export const docsPresets: ComponentPresetItem[] = [
  {
    id: "docs-callout-tip",
    name: "Callout Tip",
    category: "docs",
    icon: "IconBulb",
    description: "Pro tip callout banner with green emerald accent",
    getNode: () => ({
      type: "Callout",
      props: { variant: "tip", title: "Pro Tip" },
      children: "Helpful hint or best practice recommendation for users.",
    }),
  },
  {
    id: "docs-callout-info",
    name: "Callout Info",
    category: "docs",
    icon: "IconInfoCircle",
    description: "Informational callout banner with blue accent",
    getNode: () => ({
      type: "Callout",
      props: { variant: "info", title: "Note" },
      children: "Background context or essential documentation note.",
    }),
  },
  {
    id: "docs-callout-warning",
    name: "Callout Warning",
    category: "docs",
    icon: "IconAlertTriangle",
    description: "Warning callout banner with amber accent",
    getNode: () => ({
      type: "Callout",
      props: { variant: "warning", title: "Warning" },
      children: "Potential caveats, breaking changes, or deprecation notices.",
    }),
  },
  {
    id: "docs-code-block",
    name: "Code Block",
    category: "docs",
    icon: "IconCode",
    description: "Syntax highlighted code snippet with copy button and filename header",
    getNode: () => ({
      type: "CodeBlock",
      props: {
        language: "typescript",
        filename: "example.ts",
        code: `export function helloWorld(): string {\n  return "Hello from IRIS docs!";\n}`,
      },
    }),
  },
  {
    id: "docs-table",
    name: "API Spec Table",
    category: "docs",
    icon: "IconTable",
    description: "Structured table for API properties, types, and descriptions",
    getNode: () => ({
      type: "Table",
      children: [
        {
          type: "TableHeader",
          children: [
            {
              type: "TableRow",
              children: [
                { type: "TableHead", children: "Property" },
                { type: "TableHead", children: "Type" },
                { type: "TableHead", children: "Default" },
                { type: "TableHead", children: "Description" },
              ],
            },
          ],
        },
        {
          type: "TableBody",
          children: [
            {
              type: "TableRow",
              children: [
                { type: "TableCell", props: { className: "font-mono font-semibold text-xs" }, children: "variant" },
                { type: "TableCell", props: { className: "font-mono text-xs text-muted-foreground" }, children: '"default" | "outline"' },
                { type: "TableCell", props: { className: "font-mono text-xs text-muted-foreground" }, children: '"default"' },
                { type: "TableCell", children: "Visual styling variant of the component." },
              ],
            },
          ],
        },
      ],
    }),
  },
]
