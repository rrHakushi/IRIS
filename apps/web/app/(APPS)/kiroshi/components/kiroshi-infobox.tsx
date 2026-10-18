"use client"

import React, { memo } from "react"
import { IconExternalLink, IconInfoCircle } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import type { InfoboxItem } from "./types"

export interface KiroshiInfoboxProps {
  infoboxes: InfoboxItem[]
  className?: string
}

export const KiroshiInfobox = memo(function KiroshiInfobox({
  infoboxes,
  className,
}: KiroshiInfoboxProps): React.JSX.Element | null {
  if (!infoboxes || infoboxes.length === 0) return null

  return (
    <aside
      className={cn("w-full lg:w-80 shrink-0 space-y-4", className)}
      aria-label="Knowledge Panel"
    >
      {infoboxes.map((ib, idx) => (
        <div
          key={`${ib.infobox}-${idx}`}
          className="rounded-2xl border border-border/60 bg-card p-4 space-y-3.5 text-start shadow-xs transition-colors"
        >
          {ib.img_src && (
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted/40">
              <img
                src={ib.img_src}
                alt={ib.infobox}
                className="size-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.parentElement?.classList.add("hidden")
                }}
              />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconInfoCircle className="size-3.5 shrink-0" />
              <span className="font-medium">Knowledge Panel</span>
            </div>
            <h3 className="text-base font-bold leading-snug">{ib.infobox}</h3>
            {ib.content && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-6">
                {ib.content}
              </p>
            )}
          </div>

          {ib.attributes && ib.attributes.length > 0 && (
            <div className="space-y-1.5 border-t border-border/40 pt-3 text-xs">
              {ib.attributes.slice(0, 6).map((attr, aIdx) => {
                if (!attr) return null
                const label = attr.label || ""
                const value = attr.value || ""
                if (!label && !value) return null
                return (
                  <div key={aIdx} className="flex justify-between gap-2">
                    <span className="text-muted-foreground/80 shrink-0">
                      {label}
                    </span>
                    <span className="font-medium text-end break-all">
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {ib.urls && ib.urls.length > 0 && (
            <div className="border-t border-border/40 pt-3 flex flex-wrap gap-2">
              {ib.urls.map((u, uIdx) => {
                if (!u || !u.url) return null
                return (
                  <a
                    key={uIdx}
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <span>{u.title || "Reference"}</span>
                    <IconExternalLink className="size-3" />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </aside>
  )
})
