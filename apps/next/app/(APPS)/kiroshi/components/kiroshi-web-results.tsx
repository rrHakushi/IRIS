"use client"

import React, { memo } from "react"
import { IconExternalLink, IconWorld } from "@tabler/icons-react"
import type { SearchResult } from "./types"
import { trackKiroshiClick } from "@/lib/kiroshi-tracking"

export interface KiroshiWebResultsProps {
  results: SearchResult[]
  query: string
  className?: string
}

export const KiroshiWebResults = memo(function KiroshiWebResults({
  results,
  query,
  className,
}: KiroshiWebResultsProps): React.JSX.Element {
  const highlightSnippet = (snippet: string, searchQuery: string) => {
    if (!snippet || !searchQuery) return snippet
    const words = searchQuery
      .split(/\s+/)
      .filter((w) => w.length > 1)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    if (words.length === 0) return snippet
    const regex = new RegExp(`(${words.join("|")})`, "gi")
    const parts = snippet.split(regex)

    return parts.map((part, i) =>
      regex.test(part) ? (
        <strong key={i} className="font-semibold text-foreground">
          {part}
        </strong>
      ) : (
        part
      )
    )
  }

  const formatBreadcrumb = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr)
      const pathname = parsed.pathname
        .replace(/^\/+/, "")
        .split("/")
        .filter(Boolean)
      const pathParts = pathname.slice(0, 3).map((p) => decodeURIComponent(p))
      return [parsed.hostname.replace(/^www\./, ""), ...pathParts].join(" › ")
    } catch {
      return urlStr
    }
  }

  const getDomain = (urlStr: string) => {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, "")
    } catch {
      return ""
    }
  }

  const handleTrackClick = (res: SearchResult, thumbUrl?: string | null) => {
    trackKiroshiClick({
      url: res.url,
      title: res.title,
      category: "general",
      thumbnail: thumbUrl || undefined,
      query,
    })
  }

  return (
    <div className={className || "space-y-3 sm:space-y-3.5 min-w-0 w-full"}>
      {results.map((res, i) => {
        const thumbUrl = res.thumbnail || res.img_src
        const domain = getDomain(res.url)

        return (
          <article
            key={`${res.url}-${i}`}
            className="group relative flex flex-col space-y-2 rounded-2xl border border-border/40 bg-card/40 p-3.5 sm:p-4 text-start transition-all duration-200 hover:border-primary/40 hover:bg-card/70 shadow-xs min-w-0 w-full overflow-hidden"
          >
            {/* Domain & Favicon header row */}
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-muted-foreground/80 break-all leading-normal">
              {domain ? (
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                  alt=""
                  className="size-3.5 rounded-xs shrink-0"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              ) : (
                <IconWorld className="size-3.5 shrink-0 opacity-60" />
              )}
              <span className="font-mono truncate">{formatBreadcrumb(res.url)}</span>
            </div>

            <div className="flex items-start justify-between gap-3 sm:gap-4 min-w-0 w-full">
              <div className="flex-1 min-w-0 space-y-1">
                {/* Title */}
                <h2 className="text-base sm:text-lg font-medium leading-snug break-words">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleTrackClick(res, thumbUrl)}
                    className="text-primary/90 hover:text-primary transition-colors hover:underline inline-flex items-center gap-1.5"
                  >
                    <span>{res.title}</span>
                    <IconExternalLink className="size-3.5 opacity-0 group-hover:opacity-70 transition-opacity shrink-0" />
                  </a>
                </h2>

                {/* Content Snippet */}
                {res.content && (
                  <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground line-clamp-4 break-words">
                    {highlightSnippet(res.content, query)}
                  </p>
                )}
              </div>

              {/* Optional Thumbnail */}
              {thumbUrl && (
                <a
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleTrackClick(res, thumbUrl)}
                  className="shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/30 transition-transform duration-200 hover:scale-105"
                >
                  <img
                    src={thumbUrl}
                    alt={res.title}
                    className="size-16 sm:size-20 rounded-xl object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const parent = e.currentTarget.parentElement
                      if (parent) parent.style.display = "none"
                    }}
                  />
                </a>
              )}
            </div>

            {/* Bottom Row: Engine Badges & Archive/Cache link */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5 text-[10px] sm:text-[11px] text-muted-foreground/70">
              {res.engines && res.engines.length > 0 ? (
                res.engines.map((eng) => (
                  <span
                    key={eng}
                    className="rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:text-foreground"
                  >
                    {eng}
                  </span>
                ))
              ) : res.engine ? (
                <span className="rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] transition-colors hover:text-foreground">
                  {res.engine}
                </span>
              ) : null}

              <span className="opacity-40">•</span>

              <a
                href={`https://web.archive.org/web/${res.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground hover:underline"
              >
                cached
              </a>
            </div>
          </article>
        )
      })}
    </div>
  )
})
