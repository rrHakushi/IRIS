"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { IconExternalLink } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

interface FormattedDescriptionProps {
  text?: string | null
  collapsedCharLimit?: number
  expandable?: boolean
  className?: string
  fallbackText?: string
}

function normalizeLinkHref(href: string): {
  href: string
  isInternal: boolean
} {
  let cleanHref = href.trim()

  // Detect localhost or same-origin URLs
  if (
    cleanHref.includes("localhost:3000") ||
    cleanHref.includes("127.0.0.1:3000")
  ) {
    try {
      const u = new URL(cleanHref)
      cleanHref = u.pathname + u.search + u.hash
    } catch {
      // Ignore URL parse error
    }
  }

  // Rewrite legacy or shortcut internal paths to canonical IRIS list paths
  if (cleanHref.startsWith("/IRIS-list/characters/")) {
    cleanHref = cleanHref.replace(
      "/IRIS-list/characters/",
      "/IRIS-list/media/characters/"
    )
  } else if (cleanHref.startsWith("/IRIS-list/people/")) {
    cleanHref = cleanHref.replace(
      "/IRIS-list/people/",
      "/IRIS-list/media/people/"
    )
  } else if (cleanHref.startsWith("/character/")) {
    cleanHref = cleanHref.replace("/character/", "/IRIS-list/media/characters/")
  } else if (
    cleanHref.startsWith("/staff/") ||
    cleanHref.startsWith("/people/")
  ) {
    cleanHref = cleanHref.replace(
      /^\/(?:staff|people)\//,
      "/IRIS-list/media/people/"
    )
  }

  const isInternal = cleanHref.startsWith("/") || cleanHref.startsWith("#")
  return { href: cleanHref, isInternal }
}

function SpoilerSpan({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setRevealed((prev) => !prev)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setRevealed((prev) => !prev)
        }
      }}
      title={revealed ? "Click to hide spoiler" : "Click to reveal spoiler"}
      className={cn(
        "py-0.2 inline-block cursor-pointer rounded px-1.5 text-xs font-medium transition-all",
        revealed
          ? "bg-muted/80 text-foreground"
          : "bg-muted text-transparent blur-[5px] select-none hover:blur-[2px]"
      )}
    >
      {children}
    </span>
  )
}

function parseInlineTokens(text: string, keyPrefix: string): React.ReactNode[] {
  // Regex to match:
  // 1. Spoilers: ~!text!~
  // 2. Markdown Links: [text](url)
  // 3. Bold: **text** or __text__
  // 4. Italic: *text* or _text_
  // 5. Strikethrough: ~~text~~
  // 6. Inline code: `text`
  // 7. Raw URLs: https?://...
  const tokenRegex =
    /(~![^]*?!~|\[[^\]]+\]\([^)]+\)|(?:\*\*|__)[^]*?(?:\*\*|__)|(?:(?<=\s|^)(?:\*|_)[^*\n_]+?(?:\*|_)(?=\s|$|[.,!?;]))|~~[^]*?~~|`[^`]+`|https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g

  const parts = text.split(tokenRegex)
  const result: React.ReactNode[] = []

  parts.forEach((part, idx) => {
    if (!part) return
    const key = `${keyPrefix}-${idx}`

    // 1. Spoiler: ~! ... !~
    if (part.startsWith("~!") && part.endsWith("!~")) {
      const inner = part.slice(2, -2)
      result.push(
        <SpoilerSpan key={key}>
          {parseInlineTokens(inner, `${key}-sp`)}
        </SpoilerSpan>
      )
      return
    }

    // 2. Markdown Link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch && linkMatch[1] && linkMatch[2]) {
      const linkText = linkMatch[1]
      const rawHref = linkMatch[2]
      const { href, isInternal } = normalizeLinkHref(rawHref)

      if (isInternal) {
        result.push(
          <Link
            key={key}
            href={href}
            className="font-medium text-primary outline-none hover:underline focus-visible:underline"
          >
            {linkText}
          </Link>
        )
      } else {
        result.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
          >
            <span>{linkText}</span>
            <IconExternalLink
              className="inline size-3 shrink-0 opacity-70"
              aria-hidden="true"
            />
          </a>
        )
      }
      return
    }

    // 3. Bold: **...** or __...__
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      const inner = part.slice(2, -2)
      result.push(
        <strong key={key} className="font-semibold text-foreground">
          {parseInlineTokens(inner, `${key}-b`)}
        </strong>
      )
      return
    }

    // 4. Italic: *...* or _..._
    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      const inner = part.slice(1, -1)
      result.push(
        <em key={key} className="italic">
          {parseInlineTokens(inner, `${key}-i`)}
        </em>
      )
      return
    }

    // 5. Strikethrough: ~~...~~
    if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      const inner = part.slice(2, -2)
      result.push(
        <del key={key} className="text-muted-foreground line-through">
          {parseInlineTokens(inner, `${key}-del`)}
        </del>
      )
      return
    }

    // 6. Code: `...`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      const inner = part.slice(1, -1)
      result.push(
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"
        >
          {inner}
        </code>
      )
      return
    }

    // 7. Raw URL: https?://...
    if (/^https?:\/\//.test(part)) {
      const { href, isInternal } = normalizeLinkHref(part)
      if (isInternal) {
        result.push(
          <Link
            key={key}
            href={href}
            className="font-medium break-all text-primary outline-none hover:underline focus-visible:underline"
          >
            {part}
          </Link>
        )
      } else {
        result.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 font-medium break-all text-primary hover:underline"
          >
            <span>{part}</span>
            <IconExternalLink
              className="inline size-3 shrink-0 opacity-70"
              aria-hidden="true"
            />
          </a>
        )
      }
      return
    }

    // 8. Regular text with newlines preservation
    const lineSplits = part.split("\n")
    lineSplits.forEach((line, lineIdx) => {
      if (line) {
        result.push(line)
      }
      if (lineIdx < lineSplits.length - 1) {
        result.push(<br key={`${key}-br-${lineIdx}`} />)
      }
    })
  })

  return result
}

export function FormattedDescription({
  text,
  collapsedCharLimit = 500,
  expandable = true,
  className,
  fallbackText = "No biography available.",
}: FormattedDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Normalize line breaks & HTML br tags from raw sources
  const sanitizedText = useMemo(() => {
    if (!text) return null
    return text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  }, [text])

  // Determine if content is long enough to warrant collapse/expand
  const isLong = useMemo(() => {
    if (!sanitizedText) return false
    return sanitizedText.length > collapsedCharLimit
  }, [sanitizedText, collapsedCharLimit])

  // Split into paragraphs (by double newlines)
  const paragraphs = useMemo(() => {
    if (!sanitizedText) return []

    const textToRender =
      !isExpanded && expandable && isLong
        ? sanitizedText.slice(0, collapsedCharLimit).trim() + "…"
        : sanitizedText

    return textToRender
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
  }, [sanitizedText, isExpanded, expandable, isLong, collapsedCharLimit])

  if (!sanitizedText) {
    return (
      <p className="text-sm text-muted-foreground italic">{fallbackText}</p>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 text-sm leading-relaxed text-foreground/90 select-text",
        className
      )}
    >
      {paragraphs.map((para, idx) => (
        <p key={idx} className="leading-relaxed">
          {parseInlineTokens(para, `p-${idx}`)}
        </p>
      ))}

      {expandable && isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="cursor-pointer self-start rounded-sm pt-0.5 text-xs font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isExpanded ? "Show less" : "Read full biography"}
        </button>
      )}
    </div>
  )
}
