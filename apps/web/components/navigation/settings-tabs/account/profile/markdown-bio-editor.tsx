"use client"

import React, { useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { cn } from "@workspace/ui/lib/utils"
import {
  IconBold,
  IconItalic,
  IconStrikethrough,
  IconLink,
  IconQuote,
  IconCode,
  IconList,
  IconHeading,
  IconEye,
  IconEdit,
} from "@tabler/icons-react"

export interface MarkdownBioEditorProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  disabled?: boolean
}

/**
 * Lightweight and safe client-side markdown formatter for user bios.
 */
export function renderBioMarkdown(
  markdown: string,
  emptyText?: React.ReactNode
): React.ReactNode {
  if (!markdown || !markdown.trim()) {
    return (
      <span className="text-xs text-muted-foreground/60 italic">
        {emptyText ?? "No bio provided yet. Tell others about yourself!"}
      </span>
    )
  }

  const lines = markdown.split("\n")
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    if (rawLine === undefined) continue
    const line = rawLine

    if (!line.trim()) {
      elements.push(<div key={i} className="h-2" />)
      continue
    }

    // Heading ###
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mt-1 mb-0.5 text-xs font-bold text-foreground">
          {formatInline(line.slice(4))}
        </h4>
      )
      continue
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mt-1 mb-0.5 text-sm font-bold text-foreground">
          {formatInline(line.slice(3))}
        </h3>
      )
      continue
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="mt-1 mb-0.5 text-sm font-black text-foreground">
          {formatInline(line.slice(2))}
        </h2>
      )
      continue
    }

    // Blockquote >
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={i}
          className="my-1 rounded-r border-l-2 border-primary/60 bg-primary/5 py-0.5 pl-2.5 text-xs text-muted-foreground italic"
        >
          {formatInline(line.slice(2))}
        </blockquote>
      )
      continue
    }

    // Unordered List -
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div
          key={i}
          className="flex items-start gap-1.5 pl-1 text-xs text-foreground/90"
        >
          <span className="text-xs font-bold text-primary select-none">•</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      )
      continue
    }

    // Normal paragraph line
    elements.push(
      <p
        key={i}
        className="text-xs leading-relaxed break-words text-foreground/90"
      >
        {formatInline(line)}
      </p>
    )
  }

  return <div className="space-y-1">{elements}</div>
}

function formatInline(text: string): React.ReactNode {
  // Regex parsing for bold, italic, code, strikethrough, and links
  const tokens: React.ReactNode[] = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/)
    if (boldMatch) {
      tokens.push(
        <strong key={keyIdx++} className="font-bold text-foreground">
          {boldMatch[2]}
        </strong>
      )
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Strikethrough: ~~text~~
    const strikeMatch = remaining.match(/^~~(.*?)~~/)
    if (strikeMatch) {
      tokens.push(
        <del key={keyIdx++} className="text-muted-foreground line-through">
          {strikeMatch[1]}
        </del>
      )
      remaining = remaining.slice(strikeMatch[0].length)
      continue
    }

    // Code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push(
        <code
          key={keyIdx++}
          className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary"
        >
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Link: [title](url)
    const linkMatch = remaining.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)/)
    if (linkMatch) {
      tokens.push(
        <a
          key={keyIdx++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-primary underline transition-colors hover:text-primary/80"
        >
          {linkMatch[1]}
        </a>
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/)
    if (italicMatch) {
      tokens.push(
        <em key={keyIdx++} className="text-foreground/90 italic">
          {italicMatch[2]}
        </em>
      )
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Plain text character
    const plainChar = remaining[0]
    const nextSpecial = remaining.slice(1).search(/[\*\_\[\`\~]/)
    if (nextSpecial === -1) {
      tokens.push(remaining)
      break
    } else {
      tokens.push(remaining.slice(0, nextSpecial + 1))
      remaining = remaining.slice(nextSpecial + 1)
    }
  }

  return tokens
}

export function MarkdownBioEditor({
  value,
  onChange,
  maxLength = 500,
  disabled = false,
}: MarkdownBioEditorProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")
  const [tab, setTab] = useState<"write" | "preview">("write")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const charCount = value.length
  const isNearLimit = charCount > maxLength * 0.9
  const isAtLimit = charCount >= maxLength

  const insertFormatting = (
    prefix: string,
    suffix = "",
    placeholder = "text"
  ) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const currentVal = textarea.value

    const selectedText = currentVal.substring(start, end) || placeholder
    const replacement = `${prefix}${selectedText}${suffix}`

    const newVal =
      currentVal.substring(0, start) + replacement + currentVal.substring(end)
    if (newVal.length > maxLength) return

    onChange(newVal)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      )
    }, 10)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 shadow-2xs">
      {/* Header toolbar & tabs */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={tab === "write" ? "secondary" : "ghost"}
            size="sm"
            onPress={() => setTab("write")}
            className="h-7 gap-1 rounded-lg px-2.5 text-xs font-medium"
          >
            <IconEdit data-icon="inline-start" className="size-3.5" />
            {t("write")}
          </Button>
          <Button
            type="button"
            variant={tab === "preview" ? "secondary" : "ghost"}
            size="sm"
            onPress={() => setTab("preview")}
            className="h-7 gap-1 rounded-lg px-2.5 text-xs font-medium"
          >
            <IconEye data-icon="inline-start" className="size-3.5" />
            {t("preview")}
          </Button>
        </div>

        {tab === "write" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("**", "**", "bold text")}
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t("boldTitle")}
            >
              <IconBold className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("*", "*", "italic text")}
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t("italicTitle")}
            >
              <IconItalic className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("~~", "~~", "strikethrough text")}
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t("strikeTitle")}
            >
              <IconStrikethrough className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("### ", "", "heading")}
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t("headingTitle")}
            >
              <IconHeading className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("> ", "", "quote")}
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t("quoteTitle")}
            >
              <IconQuote className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("`", "`", "code")}
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t("codeTitle")}
            >
              <IconCode className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => insertFormatting("- ", "", "item")}
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t("listTitle")}
            >
              <IconList className="size-4" />
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                insertFormatting("[", "](https://example.com)", "link text")
              }
              className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              title={t("linkTitle")}
            >
              <IconLink className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Editor or Preview Pane */}
      {tab === "write" ? (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            disabled={disabled}
            maxLength={maxLength}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t("bioPlaceholder")}
            rows={5}
            className="min-h-[130px] w-full resize-y rounded-xl border-border/50 bg-background/50 p-3 text-xs leading-relaxed focus-visible:ring-primary/40"
          />
        </div>
      ) : (
        <div className="max-h-60 min-h-[130px] overflow-y-auto rounded-xl border border-border/40 bg-muted/20 p-3.5">
          {renderBioMarkdown(value, t("noBio"))}
        </div>
      )}

      {/* Footer info: Character Count */}
      <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
        <span>{t("formattingSupport")}</span>
        <span
          className={cn(
            "font-mono font-medium",
            isAtLimit
              ? "font-bold text-red-500"
              : isNearLimit
                ? "text-amber-500"
                : "text-muted-foreground"
          )}
        >
          {charCount} / {maxLength}
        </span>
      </div>
    </div>
  )
}
