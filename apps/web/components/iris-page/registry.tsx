"use client"

import * as React from "react"
import * as TablerIcons from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

// Import all UI primitives and components from @workspace/ui
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@workspace/ui/components/accordion"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@workspace/ui/components/alert-dialog"
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@workspace/ui/components/alert"
import { AspectRatio } from "@workspace/ui/components/aspect-ratio"
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
} from "@workspace/ui/components/attachment"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbEllipsis,
} from "@workspace/ui/components/breadcrumb"
import {
  Bubble,
  BubbleGroup,
  BubbleContent,
  BubbleReactions,
} from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupText,
} from "@workspace/ui/components/button-group"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@workspace/ui/components/carousel"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
} from "@workspace/ui/components/chart"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui/components/collapsible"
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipList,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,
} from "@workspace/ui/components/combobox"
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@workspace/ui/components/command"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@workspace/ui/components/context-menu"
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
} from "@workspace/ui/components/dialog"
import { DirectionProvider } from "@workspace/ui/components/direction"
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@workspace/ui/components/drawer"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuShortcut,
} from "@workspace/ui/components/dropdown-menu"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@workspace/ui/components/empty"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSeparator,
  FieldSet,
  FieldLegend,
  FieldContent,
  FieldTitle,
} from "@workspace/ui/components/field"
import {
  HoverCard,
  HoverCardTrigger,
} from "@workspace/ui/components/hover-card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@workspace/ui/components/input-otp"
import { Input } from "@workspace/ui/components/input"
import {
  Item,
  ItemHeader,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemContent,
  ItemMedia,
} from "@workspace/ui/components/item"
import { Kbd, KbdGroup } from "@workspace/ui/components/kbd"
import { Label } from "@workspace/ui/components/label"
import {
  Marker,
  MarkerIcon,
  MarkerContent,
} from "@workspace/ui/components/marker"
import {
  Message,
  MessageGroup,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@workspace/ui/components/message"
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@workspace/ui/components/message-scroller"
import {
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from "@workspace/ui/components/native-select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@workspace/ui/components/pagination"
import {
  Popover,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@workspace/ui/components/popover"
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
} from "@workspace/ui/components/progress"
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@workspace/ui/components/questionnaire"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@workspace/ui/components/resizable"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectInput,
  SelectList,
  SelectPopover,
  SelectEmpty,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Slider } from "@workspace/ui/components/slider"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Tabs, TabList, Tab, TabPanel } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { Toggle } from "@workspace/ui/components/toggle"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Tooltip, TooltipTrigger } from "@workspace/ui/components/tooltip"

// ============================================================================
// Tabler Icons Universal Registry (O(1) Indexed Coverage of ALL 3,500+ Icons)
// ============================================================================

export const TABLER_ICON_MAP = new Map<string, React.ComponentType<any>>()
export const ALL_TABLER_ICON_NAMES: string[] = []

for (const [exportName, Component] of Object.entries(TablerIcons)) {
  if (
    typeof Component === "function" ||
    (typeof Component === "object" && Component !== null)
  ) {
    ALL_TABLER_ICON_NAMES.push(exportName)
    const lowerName = exportName.toLowerCase()
    TABLER_ICON_MAP.set(lowerName, Component as React.ComponentType<any>)
    // Map without "Icon" prefix (e.g. "sparkles" -> IconSparkles)
    if (exportName.startsWith("Icon")) {
      const stripped = exportName.slice(4).toLowerCase()
      TABLER_ICON_MAP.set(stripped, Component as React.ComponentType<any>)
    }
  }
}

/**
 * Resolves any Tabler icon by any variation:
 * "IconSparkles", "Sparkles", "sparkles", "icon-chevron-right", "chevron_right", etc.
 */
export function resolveTablerIcon(
  name: string
): React.ComponentType<any> | undefined {
  if (!name) return undefined

  // 1. Direct export lookup
  if ((TablerIcons as Record<string, any>)[name]) {
    return (TablerIcons as Record<string, any>)[name]
  }

  // 2. PascalCase with "Icon" prefix
  const pascalWithIcon = name.startsWith("Icon")
    ? name
    : `Icon${name.charAt(0).toUpperCase()}${name.slice(1)}`
  if ((TablerIcons as Record<string, any>)[pascalWithIcon]) {
    return (TablerIcons as Record<string, any>)[pascalWithIcon]
  }

  // 3. Fast normalized lookup (handles kebab-case, snake_case, lowercase)
  const normalized = name.replace(/[-_\s]/g, "").toLowerCase()
  return (
    TABLER_ICON_MAP.get(normalized) || TABLER_ICON_MAP.get(`icon${normalized}`)
  )
}

/**
 * Universal Dynamic Tabler Icon component that resolves every single icon in @tabler/icons-react.
 */
export function DynamicIcon({
  name,
  className,
  size = 20,
  stroke = 2,
  ...props
}: {
  name: string
  className?: string
  size?: number | string
  stroke?: number | string
  [key: string]: any
}) {
  const IconComponent = resolveTablerIcon(name)

  if (!IconComponent) {
    return (
      <span
        className={`inline-flex size-4 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground ${className || ""}`}
        title={`Icon "${name}" not found`}
      >
        ?
      </span>
    )
  }

  return React.createElement(IconComponent, {
    className,
    size,
    stroke,
    ...props,
  })
}

// ============================================================================
// Standard Vanilla HTML Elements Coverage
// ============================================================================

export const HTML_TAGS = new Set([
  "a",
  "abbr",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "menu",
  "meta",
  "meter",
  "nav",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "slot",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "svg",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
])

// ============================================================================
// Specialized Documentation Primitives
// ============================================================================

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "tip" | "warning" | "danger" | "destructive" | "note"
  title?: string
  icon?: string
}

export const Callout: React.FC<CalloutProps> = ({
  variant = "info",
  title,
  icon,
  className,
  children,
  ...props
}) => {
  const variantStyles: Record<string, string> = {
    info: "border-blue-500/30 bg-blue-500/10 text-blue-950 dark:text-blue-200",
    tip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200",
    warning:
      "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200",
    danger:
      "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-200",
    destructive: "border-destructive/40 bg-destructive/10 text-destructive",
    note: "border-border/80 bg-muted/50 text-foreground",
  }

  const defaultIcons: Record<string, React.ComponentType<any>> = {
    info: TablerIcons.IconInfoCircle,
    tip: TablerIcons.IconBulb,
    warning: TablerIcons.IconAlertTriangle,
    danger: TablerIcons.IconAlertCircle,
    destructive: TablerIcons.IconAlertCircle,
    note: TablerIcons.IconNote,
  }

  const IconComp =
    icon && (TablerIcons as any)[icon]
      ? (TablerIcons as any)[icon]
      : defaultIcons[variant] || defaultIcons.info

  return (
    <div
      className={`my-4 flex items-start gap-3 rounded-2xl border p-4 text-sm leading-relaxed ${
        variantStyles[variant] || variantStyles.info
      } ${className || ""}`}
      {...props}
    >
      <IconComp className="mt-0.5 size-5 shrink-0 opacity-90" />
      <div className="flex-1 space-y-1">
        {title && <div className="font-semibold tracking-tight">{title}</div>}
        <div className="text-xs opacity-90 md:text-sm">{children}</div>
      </div>
    </div>
  )
}
Callout.displayName = "Callout"

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code?: string
  language?: string
  filename?: string
  children?: React.ReactNode
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "typescript",
  filename,
  className,
  children,
  ...props
}) => {
  const textContent = code || (typeof children === "string" ? children : "")
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className={`my-4 overflow-hidden rounded-2xl border border-border/80 bg-muted/40 shadow-xs ${
        className || ""
      }`}
      {...props}
    >
      {(filename || language) && (
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/60 px-4 py-2 font-mono text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <TablerIcons.IconCode className="size-3.5" />
            <span className="font-semibold text-foreground">
              {filename || language}
            </span>
          </div>
          {textContent && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-2 py-1 font-sans text-[11px] transition-colors hover:bg-background/80 hover:text-foreground"
            >
              {copied ? (
                <>
                  <TablerIcons.IconCheck className="size-3.5 text-emerald-500" />
                  <span className="font-medium text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <TablerIcons.IconCopy className="size-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed whitespace-pre text-foreground">
        <code>{children || code}</code>
      </pre>
    </div>
  )
}
CodeBlock.displayName = "CodeBlock"

export const DocTable: React.FC<React.HTMLAttributes<HTMLTableElement>> = ({
  className,
  ...props
}) => (
  <div className="relative my-4 w-full overflow-x-auto rounded-2xl border border-border/60 bg-card/60 shadow-xs">
    <table
      className={cn(
        "w-full caption-bottom border-collapse text-start text-sm",
        className
      )}
      {...props}
    />
  </div>
)
DocTable.displayName = "DocTable"

export const DocTableHeader: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ className, ...props }) => (
  <thead
    className={cn("border-border/60 bg-muted/40 [&_tr]:border-b", className)}
    {...props}
  />
)
DocTableHeader.displayName = "DocTableHeader"

export const DocTableBody: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ className, ...props }) => (
  <tbody
    className={cn(
      "divide-y divide-border/40 [&_tr:last-child]:border-0",
      className
    )}
    {...props}
  />
)
DocTableBody.displayName = "DocTableBody"

export const DocTableRow: React.FC<
  React.HTMLAttributes<HTMLTableRowElement>
> = ({ className, ...props }) => (
  <tr
    className={cn(
      "border-b border-border/40 transition-colors hover:bg-muted/30",
      className
    )}
    {...props}
  />
)
DocTableRow.displayName = "DocTableRow"

export const DocTableHead: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement>
> = ({ className, ...props }) => (
  <th
    className={cn(
      "h-10 px-4 text-start align-middle font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase",
      className
    )}
    {...props}
  />
)
DocTableHead.displayName = "DocTableHead"

export const DocTableCell: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement>
> = ({ className, ...props }) => (
  <td className={cn("p-4 align-middle text-sm", className)} {...props} />
)
DocTableCell.displayName = "DocTableCell"

export const DocTableFooter: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ className, ...props }) => (
  <tfoot
    className={cn("border-t bg-muted/50 font-medium", className)}
    {...props}
  />
)
DocTableFooter.displayName = "DocTableFooter"

export const DocTableCaption: React.FC<
  React.HTMLAttributes<HTMLTableCaptionElement>
> = ({ className, ...props }) => (
  <caption
    className={cn("mt-4 text-center text-sm text-muted-foreground", className)}
    {...props}
  />
)
DocTableCaption.displayName = "DocTableCaption"

// ============================================================================
// Master UI Component Registry
// ============================================================================

export const COMPONENT_REGISTRY: Record<
  string,
  React.ComponentType<any> | string
> = {
  // Documentation Specialized Primitives
  Callout,
  CodeBlock,

  // Generic Icon Resolver
  Icon: DynamicIcon,

  // Accordion
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  "Accordion.Item": AccordionItem,
  "Accordion.Trigger": AccordionTrigger,
  "Accordion.Content": AccordionContent,

  // Alert Dialog
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,

  // Alert
  Alert,
  AlertTitle,
  AlertDescription,
  "Alert.Title": AlertTitle,
  "Alert.Description": AlertDescription,

  // Aspect Ratio
  AspectRatio,

  // Attachment
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,

  // Avatar
  Avatar,
  AvatarImage,
  AvatarFallback,
  "Avatar.Image": AvatarImage,
  "Avatar.Fallback": AvatarFallback,

  // Badge
  Badge,

  // Breadcrumb
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbEllipsis,

  // Bubble
  Bubble,
  BubbleGroup,
  BubbleContent,
  BubbleReactions,

  // Button & Button Group
  Button,
  ButtonGroup,
  ButtonGroupText,

  // Calendar
  Calendar,

  // Card
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  "Card.Header": CardHeader,
  "Card.Title": CardTitle,
  "Card.Description": CardDescription,
  "Card.Action": CardAction,
  "Card.Content": CardContent,
  "Card.Footer": CardFooter,

  // Carousel
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,

  // Chart
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,

  // Checkbox
  Checkbox,

  // Collapsible
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,

  // Combobox
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxSeparator,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipList,
  ComboboxChipsInput,
  ComboboxTrigger,
  ComboboxValue,

  // Command
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,

  // Context Menu
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent: ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent: ContextMenu,

  // Dialog
  Dialog,
  DialogTrigger,
  DialogContent: Dialog,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogOverlay,
  "Dialog.Trigger": DialogTrigger,
  "Dialog.Content": Dialog,
  "Dialog.Header": DialogHeader,
  "Dialog.Footer": DialogFooter,
  "Dialog.Title": DialogTitle,
  "Dialog.Description": DialogDescription,
  "Dialog.Close": DialogClose,

  // Direction Provider
  DirectionProvider,

  // Drawer
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,

  // Dropdown Menu
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuShortcut,

  // Empty
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,

  // Field
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSeparator,
  FieldSet,
  FieldLegend,
  FieldContent,
  FieldTitle,
  "Field.Group": FieldGroup,
  "Field.Label": FieldLabel,
  "Field.Description": FieldDescription,
  "Field.Error": FieldError,

  // Hover Card
  HoverCard,
  HoverCardTrigger,
  HoverCardContent: HoverCard,

  // Input & Input Group
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,

  // Input OTP
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,

  // Item
  Item,
  ItemHeader,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemAction: ItemActions,
  ItemContent,
  ItemMedia,

  // Kbd
  Kbd,
  KbdGroup,

  // Label
  Label,

  // Marker
  Marker,
  MarkerIcon,
  MarkerContent,

  // Message & Message Scroller
  Message,
  MessageGroup,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,

  // Native Select
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,

  // Pagination
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,

  // Popover
  Popover,
  PopoverTrigger,
  PopoverContent: Popover,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,

  // Progress
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,

  // Questionnaire
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,

  // Radio Group
  RadioGroup,
  RadioGroupItem,

  // Resizable
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,

  // Scroll Area
  ScrollArea,

  // Select
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectInput,
  SelectList,
  SelectPopover,
  SelectEmpty,

  // Separator
  Separator,

  // Sheet
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,

  // Skeleton
  Skeleton,

  // Slider
  Slider,

  // Spinner
  Spinner,

  // Switch
  Switch,

  // Table (Documentation-first robust table primitives)
  Table: DocTable,
  TableHeader: DocTableHeader,
  TableBody: DocTableBody,
  TableFooter: DocTableFooter,
  TableHead: DocTableHead,
  TableRow: DocTableRow,
  TableCell: DocTableCell,
  TableCaption: DocTableCaption,

  // Tabs (supports both React Aria and shadcn names)
  Tabs,
  TabList,
  TabsList: TabList,
  Tab,
  TabsTrigger: Tab,
  TabPanel,
  TabsContent: TabPanel,
  "Tabs.List": TabList,
  "Tabs.Trigger": Tab,
  "Tabs.Content": TabPanel,

  // Textarea
  Textarea,

  // Toggle & Toggle Group
  Toggle,
  ToggleGroup,
  ToggleGroupItem,

  // Tooltip
  Tooltip,
  TooltipTrigger,
  TooltipContent: Tooltip,
}

/**
 * Resolves a component from the registry by its string name.
 * Supports:
 * 1. Registered @workspace/ui components
 * 2. Dot-notation (e.g. "Card.Header")
 * 3. All vanilla HTML elements (e.g. "div", "span", "table", "video", "img", "iframe")
 * 4. All Tabler Icons (e.g. "IconSparkles", "Sparkles", "heart", "icon-chevron-right")
 */
export function resolveComponent(
  type: string
): React.ComponentType<any> | string | undefined {
  if (!type) return undefined

  // 1. Direct registry lookup
  if (COMPONENT_REGISTRY[type]) {
    return COMPONENT_REGISTRY[type]
  }

  // 2. Handle dot notation (e.g. "Card.Header" -> "CardHeader")
  const normalized = type.replace(/\./g, "")
  if (COMPONENT_REGISTRY[normalized]) {
    return COMPONENT_REGISTRY[normalized]
  }

  // 3. Check vanilla HTML tag match (case-insensitive)
  const lowerType = type.toLowerCase()
  if (HTML_TAGS.has(lowerType)) {
    return lowerType
  }

  // 4. Check if standard lowercase HTML tag pattern (e.g. custom elements / tags)
  if (/^[a-z][a-z0-9-]*$/.test(type) && !type.startsWith("icon")) {
    return type
  }

  // 5. Universal Tabler Icon lookup
  const icon = resolveTablerIcon(type)
  if (icon) {
    return icon
  }

  return undefined
}
