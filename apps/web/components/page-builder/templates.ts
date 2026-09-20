import type { BuilderTemplate } from "./types"

export const BUILDER_TEMPLATES: BuilderTemplate[] = [
  {
    id: "docs-guide",
    name: "Getting Started Guide",
    description: "Standard documentation article with callouts, code blocks, and steps",
    icon: "IconBook",
    schema: {
      title: "Getting Started with IRIS",
      description: "Step-by-step documentation guide and tutorial",
      root: {
        type: "div",
        props: { className: "max-w-4xl mx-auto p-6 md:p-10 space-y-8" },
        children: [
          {
            type: "div",
            props: { className: "space-y-3 border-b border-border/60 pb-6" },
            children: [
              {
                type: "div",
                props: { className: "flex items-center gap-2" },
                children: [
                  { type: "Badge", props: { variant: "secondary" }, text: "Guide" },
                  { type: "Badge", props: { variant: "outline" }, text: "v2.0" },
                ],
              },
              {
                type: "h1",
                props: { className: "text-3xl font-bold tracking-tight" },
                text: "Getting Started with IRIS",
              },
              {
                type: "p",
                props: { className: "text-muted-foreground text-sm leading-relaxed" },
                text: "Learn how to compose beautiful documentation pages with modular components, typography, and clean layouts.",
              },
            ],
          },
          {
            type: "Callout",
            props: {
              variant: "tip",
              title: "Quick Tip",
            },
            text: "IRIS components strictly follow the Mauve neutral and Rose accent design specification.",
          },
          {
            type: "div",
            props: { className: "space-y-4" },
            children: [
              {
                type: "h2",
                props: { className: "text-xl font-bold tracking-tight" },
                text: "1. Installation",
              },
              {
                type: "p",
                props: { className: "text-sm text-muted-foreground leading-relaxed" },
                text: "Install the core dependencies in your workspace using pnpm.",
              },
              {
                type: "CodeBlock",
                props: {
                  language: "bash",
                  filename: "terminal",
                  code: "pnpm add @IRIS/web @workspace/ui @tabler/icons-react",
                },
              },
            ],
          },
          {
            type: "div",
            props: { className: "space-y-4" },
            children: [
              {
                type: "h2",
                props: { className: "text-xl font-bold tracking-tight" },
                text: "2. Composing Components",
              },
              {
                type: "p",
                props: { className: "text-sm text-muted-foreground leading-relaxed" },
                text: "You can assemble layouts visually in the Page Builder or write standard TSX code directly.",
              },
              {
                type: "Callout",
                props: {
                  variant: "info",
                  title: "Clean Documentation Architecture",
                },
                text: "No complicated state engines needed—only raw components, typography, and clear documentation copy.",
              },
            ],
          },
          {
            type: "Card",
            props: { className: "border-primary/30 bg-primary/5" },
            children: [
              {
                type: "CardHeader",
                children: [
                  { type: "CardTitle", props: { className: "text-base" }, text: "Next Steps" },
                  {
                    type: "CardDescription",
                    props: { className: "text-xs" },
                    text: "Explore API references, UI primitives, and design patterns.",
                  },
                ],
              },
              {
                type: "CardFooter",
                children: [
                  {
                    type: "Button",
                    props: { size: "sm", variant: "default" },
                    text: "Read API Reference",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "api-reference",
    name: "API Reference",
    description: "Endpoint documentation with method badges, parameter table, and code blocks",
    icon: "IconCode",
    schema: {
      title: "User Profile API Reference",
      description: "REST and Eden Treaty endpoint specifications",
      root: {
        type: "div",
        props: { className: "max-w-4xl mx-auto p-6 md:p-10 space-y-8" },
        children: [
          {
            type: "div",
            props: { className: "space-y-2 border-b border-border/60 pb-6" },
            children: [
              {
                type: "div",
                props: { className: "flex items-center gap-2" },
                children: [
                  { type: "Badge", props: { variant: "default" }, text: "GET" },
                  {
                    type: "code",
                    props: { className: "font-mono text-sm px-2 py-0.5 rounded bg-muted font-bold" },
                    text: "/api/v1/users/me",
                  },
                ],
              },
              {
                type: "h1",
                props: { className: "text-2xl font-bold tracking-tight pt-2" },
                text: "Get Current User Profile",
              },
              {
                type: "p",
                props: { className: "text-sm text-muted-foreground" },
                text: "Retrieves the authenticated user's profile details, active session, and assigned roles.",
              },
            ],
          },
          {
            type: "div",
            props: { className: "space-y-4" },
            children: [
              {
                type: "h3",
                props: { className: "text-base font-bold tracking-tight" },
                text: "Request Headers",
              },
              {
                type: "Table",
                children: [
                  {
                    type: "TableHeader",
                    children: [
                      {
                        type: "TableRow",
                        children: [
                          { type: "TableHead", text: "Header" },
                          { type: "TableHead", text: "Type" },
                          { type: "TableHead", text: "Description" },
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
                          { type: "TableCell", props: { className: "font-mono font-semibold text-xs" }, text: "Authorization" },
                          { type: "TableCell", props: { className: "font-mono text-xs text-muted-foreground" }, text: "string" },
                          { type: "TableCell", text: "Bearer token format: Bearer <token>" },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "div",
            props: { className: "space-y-4" },
            children: [
              {
                type: "h3",
                props: { className: "text-base font-bold tracking-tight" },
                text: "Response 200 OK",
              },
              {
                type: "CodeBlock",
                props: {
                  language: "json",
                  filename: "response.json",
                  code: `{\n  "id": "usr_9981",\n  "username": "rrHakushi",\n  "displayName": "rrHakushi",\n  "role": "ADMIN",\n  "avatarUrl": "https://avatar.iris.local/rrHakushi.png"\n}`,
                },
              },
            ],
          },
        ],
      },
    },
  },
  {
    id: "feature-showcase",
    name: "Feature Showcase",
    description: "Hero header, 3-column feature cards, and structured overview",
    icon: "IconLayoutGrid",
    schema: {
      title: "Feature Showcase",
      description: "Modern documentation showcase layout",
      root: {
        type: "div",
        props: { className: "max-w-5xl mx-auto p-6 md:p-10 space-y-10" },
        children: [
          {
            type: "div",
            props: { className: "text-center space-y-3 py-6" },
            children: [
              {
                type: "Badge",
                props: { variant: "secondary", className: "px-3 py-1" },
                text: "Documentation Engine",
              },
              {
                type: "h1",
                props: { className: "text-3xl md:text-4xl font-extrabold tracking-tight" },
                text: "Built for Clean, Beautiful Docs",
              },
              {
                type: "p",
                props: { className: "text-base text-muted-foreground max-w-xl mx-auto leading-relaxed" },
                text: "Modular UI components, markdown support, code blocks, and callouts designed for readability.",
              },
            ],
          },
          {
            type: "div",
            props: { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
            children: [
              {
                type: "Card",
                children: [
                  {
                    type: "CardHeader",
                    children: [
                      {
                        type: "div",
                        props: { className: "p-2.5 rounded-xl bg-primary/10 text-primary w-fit mb-2" },
                        children: [{ type: "Icon", props: { name: "IconBook", className: "size-5" } }],
                      },
                      { type: "CardTitle", props: { className: "text-base" }, text: "Doc Layouts" },
                      {
                        type: "CardDescription",
                        props: { className: "text-xs" },
                        text: "Structured guides, references, and tutorials with zero bloat.",
                      },
                    ],
                  },
                ],
              },
              {
                type: "Card",
                children: [
                  {
                    type: "CardHeader",
                    children: [
                      {
                        type: "div",
                        props: { className: "p-2.5 rounded-xl bg-primary/10 text-primary w-fit mb-2" },
                        children: [{ type: "Icon", props: { name: "IconCode", className: "size-5" } }],
                      },
                      { type: "CardTitle", props: { className: "text-base" }, text: "Code Blocks" },
                      {
                        type: "CardDescription",
                        props: { className: "text-xs" },
                        text: "Syntax highlighting, language badges, and one-click copy buttons.",
                      },
                    ],
                  },
                ],
              },
              {
                type: "Card",
                children: [
                  {
                    type: "CardHeader",
                    children: [
                      {
                        type: "div",
                        props: { className: "p-2.5 rounded-xl bg-primary/10 text-primary w-fit mb-2" },
                        children: [{ type: "Icon", props: { name: "IconSparkles", className: "size-5" } }],
                      },
                      { type: "CardTitle", props: { className: "text-base" }, text: "Callouts" },
                      {
                        type: "CardDescription",
                        props: { className: "text-xs" },
                        text: "Tips, warnings, info notes, and important callout banners.",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
]
