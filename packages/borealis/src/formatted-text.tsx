"use client"

import React, { useMemo, useState } from "react"
import { IconExternalLink } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

interface BorealisFormattedTextProps {
  text?: string | null
  className?: string
  fallback?: string
  maxLines?: number
}

function normalizeUrl(href: string): string {
  let clean = href.trim()
  if (!clean.startsWith("http://") && !clean.startsWith("https://") && !clean.startsWith("/")) {
    clean = `https://${clean}`
  }
  return clean
}

function SpoilerBlock({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)

  if (!revealed) {
    return (
      <span className="my-1 inline-block">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setRevealed(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700/80 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] font-semibold text-amber-300 hover:bg-zinc-800 hover:text-amber-200 transition-colors cursor-pointer select-none"
        >
          <span>⚠️ Spoiler (click to show)</span>
        </button>
      </span>
    )
  }

  return (
    <div className="my-2 rounded-lg border border-zinc-700/80 bg-zinc-900/90 p-2.5 text-zinc-200">
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-mono font-bold text-zinc-400">
        <span>SPOILER</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setRevealed(false)
          }}
          className="text-zinc-400 hover:text-zinc-100 hover:underline cursor-pointer"
        >
          Hide
        </button>
      </div>
      <div className="text-xs leading-relaxed text-zinc-200">{children}</div>
    </div>
  )
}

function parseTokens(content: string, prefix: string): React.ReactNode[] {
  // Matches:
  // 1. Spoilers: ~!text!~
  // 2. Markdown Links: [text](url)
  // 3. Bold: **text** or __text__
  // 4. Italic: *text* or _text_
  // 5. Raw URLs: https?://...
  const tokenRegex =
    /(~![^]*?!~|\[[^\]]+\]\([^)]+\)|(?:\*\*|__)[^]+?(?:\*\*|__)|https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g

  const parts = content.split(tokenRegex)
  const elements: React.ReactNode[] = []

  parts.forEach((part, idx) => {
    if (!part) return
    const key = `${prefix}-${idx}`

    // 1. Spoiler
    if (part.startsWith("~!") && part.endsWith("!~")) {
      const inner = part.slice(2, -2).trim()
      elements.push(
        <SpoilerBlock key={key}>
          {parseTokens(inner, `${key}-sp`)}
        </SpoilerBlock>
      )
      return
    }

    // 2. Markdown Link: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch && linkMatch[1] && linkMatch[2]) {
      const label = linkMatch[1]
      const rawUrl = linkMatch[2]
      const cleanUrl = normalizeUrl(rawUrl)

      elements.push(
        <a
          key={key}
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors cursor-pointer select-text"
        >
          <span>{label}</span>
          <IconExternalLink className="size-2.5 inline opacity-80 shrink-0" aria-hidden="true" />
        </a>
      )
      return
    }

    // 3. Bold: **...** or __...__
    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      const inner = part.slice(2, -2)
      elements.push(
        <strong key={key} className="font-bold text-zinc-100">
          {parseTokens(inner, `${key}-b`)}
        </strong>
      )
      return
    }

    // 4. Raw URL
    if (/^https?:\/\//.test(part)) {
      const cleanUrl = normalizeUrl(part)
      elements.push(
        <a
          key={key}
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 break-all transition-colors cursor-pointer select-text"
        >
          <span>{part}</span>
          <IconExternalLink className="size-2.5 inline opacity-80 shrink-0" aria-hidden="true" />
        </a>
      )
      return
    }

    // 5. Plain text with preserved newlines
    const lines = part.split("\n")
    lines.forEach((line, lineIdx) => {
      if (line) elements.push(line)
      if (lineIdx < lines.length - 1) {
        elements.push(<br key={`${key}-br-${lineIdx}`} />)
      }
    })
  })

  return elements
}

export function BorealisFormattedText({
  text,
  className,
  fallback = "No description available.",
  maxLines,
}: BorealisFormattedTextProps) {
  const sanitized = useMemo(() => {
    if (!text) return null
    return text
      .replace(/<b\b[^>]*>(.*?)<\/b>/gi, (_, s) => `**${s}**`)
      .replace(/<strong\b[^>]*>(.*?)<\/strong>/gi, (_, s) => `**${s}**`)
      .replace(/<i\b[^>]*>(.*?)<\/i>/gi, (_, s) => `*${s}*`)
      .replace(/<em\b[^>]*>(.*?)<\/em>/gi, (_, s) => `*${s}*`)
      .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, (_, u, l) => `[${l}](${u})`)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }, [text])

  if (!sanitized) {
    return <p className="text-xs text-zinc-400 italic">{fallback}</p>
  }

  return (
    <div
      className={cn(
        "select-text cursor-auto text-xs leading-relaxed text-zinc-200 font-normal",
        maxLines && `line-clamp-${maxLines}`,
        className
      )}
    >
      {parseTokens(sanitized, "bft")}
    </div>
  )
}

