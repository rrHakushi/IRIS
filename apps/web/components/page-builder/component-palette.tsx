"use client"

import * as React from "react"
import {
  IconBox,
  IconColumns,
  IconCreditCard,
  IconCursorText,
  IconFileText,
  IconForms,
  IconHandClick,
  IconInfoCircle,
  IconLayersLinked,
  IconListDetails,
  IconPhoto,
  IconPlus,
  IconProgress,
  IconRefresh,
  IconSearch,
  IconSparkles,
  IconToggleLeft,
  IconTypography,
  IconUser,
} from "@tabler/icons-react"

import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { DynamicIcon, ALL_TABLER_ICON_NAMES, type IrisNode } from "@/components/iris-page"
import type { PaletteCategory, PaletteItem } from "./types"

export const PALETTE_ITEMS: PaletteItem[] = [
  // Layout
  {
    id: "card",
    label: "Card Container",
    icon: "IconCreditCard",
    category: "layout",
    description: "Surface card with header, title, and body",
    defaultNode: {
      type: "Card",
      children: [
        {
          type: "CardHeader",
          children: [
            { type: "CardTitle", children: "Card Heading" },
            { type: "CardDescription", children: "Card subtitle and details" },
          ],
        },
        {
          type: "CardContent",
          props: { className: "space-y-2" },
          children: [
            { type: "p", props: { className: "text-sm text-muted-foreground" }, children: "Put your card content here." },
          ],
        },
      ],
    },
  },
  {
    id: "container",
    label: "Box Container",
    icon: "IconBox",
    category: "layout",
    description: "Padded box container with border",
    defaultNode: {
      type: "div",
      props: { className: "rounded-2xl border border-border/60 bg-card p-4 space-y-3" },
      children: [],
    },
  },
  {
    id: "grid-2",
    label: "2-Column Grid",
    icon: "IconColumns",
    category: "layout",
    description: "Responsive 2-column grid layout",
    defaultNode: {
      type: "div",
      props: { className: "grid grid-cols-1 md:grid-cols-2 gap-4" },
      children: [
        {
          type: "div",
          props: { className: "p-4 rounded-xl border border-dashed border-border/60" },
          children: "Column 1",
        },
        {
          type: "div",
          props: { className: "p-4 rounded-xl border border-dashed border-border/60" },
          children: "Column 2",
        },
      ],
    },
  },
  {
    id: "grid-3",
    label: "3-Column Grid",
    icon: "IconColumns",
    category: "layout",
    description: "Responsive 3-column metric grid",
    defaultNode: {
      type: "div",
      props: { className: "grid grid-cols-1 md:grid-cols-3 gap-4" },
      children: [
        {
          type: "div",
          props: { className: "p-4 rounded-xl border border-dashed border-border/60" },
          children: "Column 1",
        },
        {
          type: "div",
          props: { className: "p-4 rounded-xl border border-dashed border-border/60" },
          children: "Column 2",
        },
        {
          type: "div",
          props: { className: "p-4 rounded-xl border border-dashed border-border/60" },
          children: "Column 3",
        },
      ],
    },
  },
  {
    id: "tabs",
    label: "Tabs Section",
    icon: "IconLayersLinked",
    category: "layout",
    description: "Tabbed switchable panels",
    defaultNode: {
      type: "Tabs",
      props: { defaultValue: "tab1", className: "w-full space-y-4" },
      children: [
        {
          type: "TabsList",
          children: [
            { type: "TabsTrigger", props: { id: "tab1" }, children: "Overview" },
            { type: "TabsTrigger", props: { id: "tab2" }, children: "Details" },
          ],
        },
        {
          type: "TabsContent",
          props: { id: "tab1" },
          children: "Tab 1 content panel",
        },
        {
          type: "TabsContent",
          props: { id: "tab2" },
          children: "Tab 2 content panel",
        },
      ],
    },
  },
  {
    id: "separator",
    label: "Separator Line",
    icon: "IconFileText",
    category: "layout",
    description: "Horizontal divider rule",
    defaultNode: {
      type: "Separator",
    },
  },

  // Typography
  {
    id: "heading-1",
    label: "Heading 1",
    icon: "IconTypography",
    category: "typography",
    description: "Page level primary title",
    defaultNode: {
      type: "h1",
      props: { className: "font-heading text-2xl font-bold tracking-tight" },
      children: "Section Title",
    },
  },
  {
    id: "heading-2",
    label: "Heading 2",
    icon: "IconTypography",
    category: "typography",
    description: "Secondary section header",
    defaultNode: {
      type: "h2",
      props: { className: "font-heading text-lg font-semibold" },
      children: "Subtitle Heading",
    },
  },
  {
    id: "paragraph",
    label: "Paragraph",
    icon: "IconFileText",
    category: "typography",
    description: "Body text with muted styling",
    defaultNode: {
      type: "p",
      props: { className: "text-sm text-muted-foreground leading-relaxed" },
      children: "Write your description text here. Supports dynamic expressions like {{ user.username }}.",
    },
  },

  // Forms
  {
    id: "button-default",
    label: "Primary Button",
    icon: "IconHandClick",
    category: "forms",
    description: "Primary rose accent action button",
    defaultNode: {
      type: "Button",
      props: { variant: "default", size: "default" },
      children: "Primary Button",
    },
  },
  {
    id: "button-outline",
    label: "Outline Button",
    icon: "IconHandClick",
    category: "forms",
    description: "Bordered secondary action button",
    defaultNode: {
      type: "Button",
      props: { variant: "outline", size: "default" },
      children: "Secondary Button",
    },
  },
  {
    id: "input-field",
    label: "Text Input Field",
    icon: "IconCursorText",
    category: "forms",
    description: "Text input with label and description",
    defaultNode: {
      type: "Field",
      children: [
        { type: "FieldLabel", children: "Field Name" },
        { type: "Input", props: { placeholder: "Enter text..." } },
        { type: "FieldDescription", children: "Helper text for the input field" },
      ],
    },
  },
  {
    id: "textarea-field",
    label: "Textarea Field",
    icon: "IconForms",
    category: "forms",
    description: "Multi-line text input field",
    defaultNode: {
      type: "Field",
      children: [
        { type: "FieldLabel", children: "Message" },
        { type: "Textarea", props: { placeholder: "Write detailed message..." } },
      ],
    },
  },
  {
    id: "switch-row",
    label: "Switch Toggle Row",
    icon: "IconToggleLeft",
    category: "forms",
    description: "Boolean toggle with title and description",
    defaultNode: {
      type: "div",
      props: { className: "flex items-center justify-between p-3 rounded-2xl border bg-muted/20" },
      children: [
        {
          type: "div",
          children: [
            { type: "span", props: { className: "text-sm font-medium" }, children: "Enable Feature" },
            { type: "p", props: { className: "text-xs text-muted-foreground" }, children: "Toggle state on or off" },
          ],
        },
        { type: "Switch", props: { "aria-label": "Toggle" } },
      ],
    },
  },

  // Feedback
  {
    id: "badge",
    label: "Badge Chip",
    icon: "IconSparkles",
    category: "feedback",
    description: "Status badge indicator",
    defaultNode: {
      type: "Badge",
      props: { variant: "secondary" },
      children: "Active Status",
    },
  },
  {
    id: "alert",
    label: "Alert Box",
    icon: "IconInfoCircle",
    category: "feedback",
    description: "Status notification banner",
    defaultNode: {
      type: "Alert",
      props: { variant: "info" },
      children: [
        { type: "Icon", props: { name: "IconInfoCircle", className: "size-4" } },
        { type: "AlertTitle", children: "Important Notice" },
        { type: "AlertDescription", children: "Informational message displayed to the user." },
      ],
    },
  },
  {
    id: "progress",
    label: "Progress Bar",
    icon: "IconProgress",
    category: "feedback",
    description: "Visual percentage meter",
    defaultNode: {
      type: "Progress",
      props: { value: 75, "aria-label": "Completion Meter" },
    },
  },

  // Media
  {
    id: "avatar",
    label: "User Avatar",
    icon: "IconUser",
    category: "media",
    description: "Circular avatar with image & fallback",
    defaultNode: {
      type: "Avatar",
      props: { size: "lg" },
      children: [
        { type: "AvatarFallback", children: "IR" },
      ],
    },
  },
  {
    id: "icon",
    label: "Tabler Icon",
    icon: "IconPhoto",
    category: "media",
    description: "Vector icon from @tabler/icons-react",
    defaultNode: {
      type: "Icon",
      props: { name: "IconSparkles", className: "size-5 text-primary" },
    },
  },

  // Advanced
  {
    id: "repeater",
    label: "Array Repeater List",
    icon: "IconListDetails",
    category: "advanced",
    description: "Loop over array in state dynamically",
    defaultNode: {
      type: "div",
      repeat: { items: "state.items", as: "item", indexAs: "idx" },
      props: { className: "p-3 rounded-2xl border border-border/60 bg-muted/20 flex items-center justify-between" },
      children: [
        { type: "span", props: { className: "text-sm font-medium" }, children: "{{ item.name || item }}" },
        { type: "Badge", props: { variant: "outline" }, children: "#{{ idx + 1 }}" },
      ],
    },
  },

  // HTML Semantic Elements
  {
    id: "html-div",
    label: "div (Box)",
    icon: "IconBox",
    category: "html",
    description: "Standard HTML division container",
    defaultNode: {
      type: "div",
      props: { className: "p-4 space-y-2" },
      children: [],
    },
  },
  {
    id: "html-section",
    label: "section",
    icon: "IconLayoutDashboard",
    category: "html",
    description: "Semantic HTML section container",
    defaultNode: {
      type: "section",
      props: { className: "py-6 space-y-4" },
      children: [],
    },
  },
  {
    id: "html-article",
    label: "article",
    icon: "IconFileText",
    category: "html",
    description: "Semantic HTML article element",
    defaultNode: {
      type: "article",
      props: { className: "prose dark:prose-invert max-w-none" },
      children: [],
    },
  },
  {
    id: "html-header",
    label: "header",
    icon: "IconLayoutHeader",
    category: "html",
    description: "Semantic HTML header element",
    defaultNode: {
      type: "header",
      props: { className: "border-b border-border/40 pb-4 mb-4" },
      children: [],
    },
  },
  {
    id: "html-footer",
    label: "footer",
    icon: "IconLayoutBottombar",
    category: "html",
    description: "Semantic HTML footer element",
    defaultNode: {
      type: "footer",
      props: { className: "border-t border-border/40 pt-4 mt-8 text-xs text-muted-foreground" },
      children: [],
    },
  },
  {
    id: "html-nav",
    label: "nav",
    icon: "IconCompass",
    category: "html",
    description: "Semantic HTML navigation element",
    defaultNode: {
      type: "nav",
      props: { className: "flex items-center gap-4 text-sm" },
      children: [],
    },
  },
  {
    id: "html-aside",
    label: "aside",
    icon: "IconLayoutSidebar",
    category: "html",
    description: "Semantic HTML aside element",
    defaultNode: {
      type: "aside",
      props: { className: "p-4 border-s border-border/40" },
      children: [],
    },
  },
  {
    id: "html-main",
    label: "main",
    icon: "IconLayout",
    category: "html",
    description: "Semantic HTML main content container",
    defaultNode: {
      type: "main",
      props: { className: "w-full flex-1 space-y-6" },
      children: [],
    },
  },
  {
    id: "html-p",
    label: "p (Paragraph)",
    icon: "IconTypography",
    category: "html",
    description: "Standard HTML paragraph text",
    defaultNode: {
      type: "p",
      props: { className: "text-sm text-foreground leading-relaxed" },
      children: "This is a standard HTML paragraph element.",
    },
  },
  {
    id: "html-span",
    label: "span",
    icon: "IconTypography",
    category: "html",
    description: "Inline text span",
    defaultNode: {
      type: "span",
      props: { className: "text-sm font-medium" },
      children: "Inline span text",
    },
  },
  {
    id: "html-h1",
    label: "h1 (Main Heading)",
    icon: "IconH1",
    category: "html",
    description: "Top-level HTML heading",
    defaultNode: {
      type: "h1",
      props: { className: "text-3xl font-extrabold tracking-tight font-heading" },
      children: "Main Page Heading",
    },
  },
  {
    id: "html-h2",
    label: "h2 (Sub Heading)",
    icon: "IconH2",
    category: "html",
    description: "Section HTML heading",
    defaultNode: {
      type: "h2",
      props: { className: "text-xl font-bold tracking-tight font-heading" },
      children: "Section Heading",
    },
  },
  {
    id: "html-h3",
    label: "h3 (Minor Heading)",
    icon: "IconH3",
    category: "html",
    description: "Sub-section HTML heading",
    defaultNode: {
      type: "h3",
      props: { className: "text-base font-semibold" },
      children: "Subsection Title",
    },
  },
  {
    id: "html-a",
    label: "a (Link)",
    icon: "IconLink",
    category: "html",
    description: "HTML hyperlink anchor",
    defaultNode: {
      type: "a",
      props: { href: "#", className: "text-sm text-primary hover:underline" },
      children: "Click here to navigate",
    },
  },
  {
    id: "html-img",
    label: "img (Image)",
    icon: "IconPhoto",
    category: "html",
    description: "HTML image element",
    defaultNode: {
      type: "img",
      props: {
        src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
        alt: "Demo Image",
        className: "w-full max-w-md rounded-2xl object-cover shadow-sm",
      },
    },
  },
  {
    id: "html-video",
    label: "video",
    icon: "IconVideo",
    category: "html",
    description: "HTML5 video player element",
    defaultNode: {
      type: "video",
      props: {
        controls: true,
        src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        className: "w-full max-w-lg rounded-2xl shadow-sm",
      },
    },
  },
  {
    id: "html-iframe",
    label: "iframe (Embed)",
    icon: "IconWindow",
    category: "html",
    description: "HTML iframe web embed",
    defaultNode: {
      type: "iframe",
      props: {
        src: "https://example.com",
        title: "Embedded View",
        className: "w-full h-80 rounded-2xl border border-border/60",
      },
    },
  },
  {
    id: "html-ul",
    label: "ul / li (List)",
    icon: "IconList",
    category: "html",
    description: "HTML unordered bullet list",
    defaultNode: {
      type: "ul",
      props: { className: "list-disc list-inside space-y-1 text-sm text-muted-foreground" },
      children: [
        { type: "li", children: "First item in unordered list" },
        { type: "li", children: "Second item in unordered list" },
        { type: "li", children: "Third item in unordered list" },
      ],
    },
  },
  {
    id: "html-table",
    label: "table (Vanilla)",
    icon: "IconTable",
    category: "html",
    description: "Raw HTML table element with rows and cells",
    defaultNode: {
      type: "table",
      props: { className: "w-full text-sm text-start border-collapse" },
      children: [
        {
          type: "thead",
          children: [
            {
              type: "tr",
              props: { className: "border-b border-border text-muted-foreground font-semibold" },
              children: [
                { type: "th", props: { className: "p-2 text-start" }, children: "Name" },
                { type: "th", props: { className: "p-2 text-start" }, children: "Status" },
                { type: "th", props: { className: "p-2 text-end" }, children: "Value" },
              ],
            },
          ],
        },
        {
          type: "tbody",
          children: [
            {
              type: "tr",
              props: { className: "border-b border-border/40" },
              children: [
                { type: "td", props: { className: "p-2" }, children: "Alpha" },
                { type: "td", props: { className: "p-2 text-emerald-500 font-medium" }, children: "Active" },
                { type: "td", props: { className: "p-2 text-end font-mono" }, children: "$120.00" },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "html-details",
    label: "details / summary",
    icon: "IconChevronDown",
    category: "html",
    description: "HTML native collapsible toggle",
    defaultNode: {
      type: "details",
      props: { className: "rounded-xl border border-border/60 bg-muted/20 p-3 text-sm" },
      children: [
        { type: "summary", props: { className: "cursor-pointer font-medium select-none" }, children: "Click to toggle content" },
        { type: "p", props: { className: "pt-2 text-muted-foreground text-xs" }, children: "Hidden details revealed natively by HTML!" },
      ],
    },
  },
  {
    id: "html-blockquote",
    label: "blockquote",
    icon: "IconQuote",
    category: "html",
    description: "HTML blockquote with border",
    defaultNode: {
      type: "blockquote",
      props: { className: "border-s-2 border-primary ps-4 italic text-sm text-muted-foreground" },
      children: "Creativity is intelligence having fun.",
    },
  },
  {
    id: "html-hr",
    label: "hr (Divider)",
    icon: "IconMinus",
    category: "html",
    description: "Horizontal rule divider",
    defaultNode: {
      type: "hr",
      props: { className: "border-t border-border/60 my-4" },
    },
  },

  // Additional UI components
  {
    id: "button-group",
    label: "Button Group",
    icon: "IconLayoutNavbar",
    category: "layout",
    description: "Grouped adjoining buttons",
    defaultNode: {
      type: "ButtonGroup",
      children: [
        { type: "Button", props: { variant: "outline", size: "sm" }, children: "Left" },
        { type: "Button", props: { variant: "outline", size: "sm" }, children: "Middle" },
        { type: "Button", props: { variant: "outline", size: "sm" }, children: "Right" },
      ],
    },
  },
  {
    id: "attachment-item",
    label: "Attachment",
    icon: "IconPaperclip",
    category: "media",
    description: "File attachment card with title and action",
    defaultNode: {
      type: "Attachment",
      children: [
        { type: "AttachmentMedia", children: [{ type: "Icon", props: { name: "IconFileText", className: "size-4" } }] },
        {
          type: "AttachmentContent",
          children: [
            { type: "AttachmentTitle", children: "document.pdf" },
            { type: "AttachmentDescription", children: "2.4 MB • Ready" },
          ],
        },
      ],
    },
  },
  {
    id: "chat-bubble",
    label: "Chat Bubble",
    icon: "IconMessageCircle",
    category: "feedback",
    description: "Message chat bubble with styling",
    defaultNode: {
      type: "Bubble",
      props: { variant: "default", align: "start" },
      children: [
        { type: "BubbleContent", children: "Hello from Server-Driven UI in IRIS!" },
      ],
    },
  },
  {
    id: "input-otp",
    label: "OTP Pin Input",
    icon: "IconKey",
    category: "forms",
    description: "One-Time Password 6-digit pin code input",
    defaultNode: {
      type: "InputOTP",
      props: { maxLength: 6 },
      children: [
        {
          type: "InputOTPGroup",
          children: [
            { type: "InputOTPSlot", props: { index: 0 } },
            { type: "InputOTPSlot", props: { index: 1 } },
            { type: "InputOTPSlot", props: { index: 2 } },
            { type: "InputOTPSeparator" },
            { type: "InputOTPSlot", props: { index: 3 } },
            { type: "InputOTPSlot", props: { index: 4 } },
            { type: "InputOTPSlot", props: { index: 5 } },
          ],
        },
      ],
    },
  },
  {
    id: "native-select",
    label: "Native HTML Select",
    icon: "IconSelector",
    category: "forms",
    description: "Native OS styled dropdown select",
    defaultNode: {
      type: "NativeSelect",
      children: [
        { type: "NativeSelectOption", props: { value: "1" }, children: "Option One" },
        { type: "NativeSelectOption", props: { value: "2" }, children: "Option Two" },
        { type: "NativeSelectOption", props: { value: "3" }, children: "Option Three" },
      ],
    },
  },
]

interface ComponentPaletteProps {
  onInsertNode: (node: IrisNode) => void
}

export function ComponentPalette({ onInsertNode }: ComponentPaletteProps) {
  const [search, setSearch] = React.useState("")
  const [activeCategory, setActiveCategory] = React.useState<string>("all")

  const filteredItems = React.useMemo(() => {
    return PALETTE_ITEMS.filter((item) => {
      const matchesSearch =
        search === "" ||
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase())
      const matchesCat = activeCategory === "all" || item.category === activeCategory
      return matchesSearch && matchesCat
    })
  }, [search, activeCategory])

  const matchingIcons = React.useMemo(() => {
    if (activeCategory !== "icons") return []
    if (!search.trim()) return ALL_TABLER_ICON_NAMES
    const q = search.toLowerCase().replace(/^icon/, "")
    return ALL_TABLER_ICON_NAMES.filter((name) =>
      name.toLowerCase().includes(q)
    )
  }, [search, activeCategory])

  const categories: Array<{ id: string; label: string }> = [
    { id: "all", label: "All" },
    { id: "layout", label: "Layout" },
    { id: "html", label: "HTML" },
    { id: "icons", label: "Icons" },
    { id: "forms", label: "Forms" },
    { id: "typography", label: "Text" },
    { id: "feedback", label: "Status" },
    { id: "media", label: "Media" },
    { id: "advanced", label: "Advanced" },
  ]

  return (
    <aside className="flex h-full w-72 flex-col border-e border-border/60 bg-card/60 backdrop-blur-md">
      {/* Header & Search */}
      <div className="p-3 border-b border-border/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {activeCategory === "icons" ? "Tabler Icons" : "Components"}
          </span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {activeCategory === "icons" ? `${matchingIcons.length} Icons` : `${PALETTE_ITEMS.length} Primitives`}
          </Badge>
        </div>
        <div className="relative">
          <Input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder={activeCategory === "icons" ? "Search 3,500+ icons..." : "Search blocks..."}
            className="h-8 text-xs ps-8 rounded-xl"
            aria-label="Search components"
          />
          <IconSearch className="absolute start-2.5 top-2 size-3.5 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex gap-1 overflow-x-auto p-2 border-b border-border/40 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2.5 py-1 text-[11px] rounded-lg font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Content Area: Icons Browser or Component List */}
      {activeCategory === "icons" ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
            <span>{matchingIcons.length} matches</span>
            <span>Click to add</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {matchingIcons.slice(0, 120).map((iconName) => (
              <button
                key={iconName}
                type="button"
                onClick={() =>
                  onInsertNode({
                    type: "Icon",
                    props: { name: iconName, className: "size-5" },
                  })
                }
                title={iconName}
                className="group flex flex-col items-center justify-center p-2 rounded-xl border border-border/40 bg-muted/20 hover:bg-primary/10 hover:border-primary/50 transition-all text-center aspect-square"
              >
                <DynamicIcon name={iconName} className="size-5 text-foreground group-hover:text-primary transition-colors" />
                <span className="text-[9px] text-muted-foreground truncate w-full mt-1 group-hover:text-primary">
                  {iconName.replace(/^Icon/, "")}
                </span>
              </button>
            ))}
          </div>
          {matchingIcons.length > 120 && (
            <p className="text-center text-[10px] text-muted-foreground py-2">
              Showing first 120 matches. Type in search to filter.
            </p>
          )}
          {matchingIcons.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No Tabler icons match "{search}"
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onInsertNode(JSON.parse(JSON.stringify(item.defaultNode)))}
              className="group flex w-full items-start gap-2.5 rounded-xl border border-transparent p-2.5 text-start transition-all hover:border-border/80 hover:bg-muted/40 hover:shadow-xs focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <IconPlus className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    + Add
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{item.description}</p>
              </div>
            </button>
          ))}

          {filteredItems.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No components match "{search}"
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
