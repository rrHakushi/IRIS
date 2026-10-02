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

import { MarkdownRenderer } from "@/components/markdown"

export interface MarkdownBioEditorProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  disabled?: boolean
}

/**
 * Client-side markdown formatter for user bios with full GFM and whitespace support.
 */
export function renderBioMarkdown(
  markdown: string,
  emptyText?: React.ReactNode
): React.ReactNode {
  return (
    <MarkdownRenderer
      content={markdown}
      emptyText={
        <span className="text-xs text-muted-foreground/60 italic">
          {emptyText ?? "No bio provided yet. Tell others about yourself!"}
        </span>
      }
      preserveSpaces={true}
    />
  )
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
          <MarkdownRenderer content={value} emptyText={t("noBio")} />
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
