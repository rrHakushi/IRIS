"use client"

import React, { memo } from "react"
import { IconPlayerPlay, IconExternalLink } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { trackKiroshiClick } from "@/lib/kiroshi-tracking"
import type { SearchResult } from "./types"

export interface KiroshiVideosListProps {
  results: SearchResult[]
  query: string
  className?: string
}

export const KiroshiVideosList = memo(function KiroshiVideosList({
  results,
  query,
  className,
}: KiroshiVideosListProps): React.JSX.Element {
  const formatBreadcrumb = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr)
      const pathname = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean)
      const pathParts = pathname.slice(0, 2).map((p) => decodeURIComponent(p))
      return [parsed.hostname.replace(/^www\./, ""), ...pathParts].join(" › ")
    } catch {
      return urlStr
    }
  }

  const formatPublishedDate = (dateVal: unknown): string | null => {
    if (!dateVal) return null
    if (dateVal instanceof Date) return dateVal.toLocaleDateString()
    if (typeof dateVal === "string") {
      const parsed = new Date(dateVal)
      return isNaN(parsed.getTime()) ? dateVal : parsed.toLocaleDateString()
    }
    if (typeof dateVal === "number") return new Date(dateVal).toLocaleDateString()
    return null
  }

  return (
    <div className={className || "space-y-3.5 sm:space-y-4"}>
      {results.map((res, i) => {
        const thumb = res.thumbnail || res.img_src
        return (
          <article
            key={`${res.url}-${i}`}
            className="group relative flex flex-col sm:flex-row gap-3.5 rounded-2xl border border-border/40 bg-card/40 p-3.5 sm:p-4 transition-all duration-200 hover:border-primary/40 hover:bg-card/60"
          >
            {thumb && (
              <a
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackKiroshiClick({
                    url: res.url,
                    title: res.title,
                    category: "videos",
                    query,
                    thumbnail: thumb,
                  })
                }
                className="relative aspect-video w-full sm:w-52 shrink-0 overflow-hidden rounded-xl bg-muted/40 shadow-xs transition-transform duration-300 group-hover:scale-[1.02]"
              >
                <img
                  src={thumb}
                  alt={res.title}
                  className="size-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px] transition-opacity group-hover:bg-black/10">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-md transition-transform group-hover:scale-110">
                    <IconPlayerPlay className="ms-0.5 size-5" />
                  </div>
                </div>
              </a>
            )}

            <div className="flex flex-1 flex-col justify-between space-y-1.5 min-w-0">
              <div className="space-y-1">
                <div className="text-[11px] text-muted-foreground/80 font-mono break-all">
                  {formatBreadcrumb(res.url)}
                </div>
                <h3 className="text-base font-semibold leading-snug">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackKiroshiClick({
                        url: res.url,
                        title: res.title,
                        category: "videos",
                        query,
                        thumbnail: thumb || undefined,
                      })
                    }
                    className="text-foreground hover:text-primary transition-colors hover:underline inline-flex items-center gap-1.5"
                  >
                    <span>{res.title}</span>
                    <IconExternalLink className="size-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                  </a>
                </h3>
                {res.content && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {res.content}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                {res.engine && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {res.engine}
                  </Badge>
                )}
                {res.publishedDate && (
                  <span>{formatPublishedDate(res.publishedDate)}</span>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
})
