"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import {
  IconHistory,
  IconX,
  IconTrash,
  IconChevronDown,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

interface BrowseRecentQueriesProps {
  queries: string[]
  categoryLabel: string
  onSelectQuery: (query: string) => void
  onRemoveQuery: (query: string) => void
  onClearCategory: () => void
  onClearAll: () => void
  hasVisitedItems?: boolean
}

export function BrowseRecentQueries({
  queries,
  categoryLabel,
  onSelectQuery,
  onRemoveQuery,
  onClearCategory,
  onClearAll,
  hasVisitedItems = false,
}: BrowseRecentQueriesProps) {
  const t = useTranslations("browse")
  const [showClearMenu, setShowClearMenu] = useState(false)

  if (queries.length === 0 && !hasVisitedItems) {
    return null
  }

  return (
    <section
      aria-label={t("recentSearches")}
      className="flex w-full flex-col gap-1.5 pt-1"
    >
      {/* Top row: Recent indicator on left, Clear button on right */}
      <div className="flex items-center justify-between gap-2">
        {queries.length > 0 ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <IconHistory
              className="size-3.5 text-primary/80"
              aria-hidden="true"
            />
            <span>{t("recent")}</span>
          </div>
        ) : (
          <div />
        )}

        {/* Right: Clear button with dropdown */}
        <div className="relative ms-auto">
          <div className="inline-flex items-center rounded-xl border border-border/50 bg-background text-xs shadow-xs">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onPress={() => onClearCategory()}
              className="h-7 gap-1 rounded-s-xl rounded-e-none px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-destructive"
              aria-label={t("clearCategoryTitle", { category: categoryLabel })}
            >
              <IconTrash className="size-3.5" aria-hidden="true" />
              <span>{t("clearCategory", { category: categoryLabel })}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onPress={() => setShowClearMenu((prev) => !prev)}
              aria-label={t("moreClearOptions")}
              aria-expanded={showClearMenu}
              className="h-7 w-6 rounded-s-none rounded-e-xl border-s border-border/50 px-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <IconChevronDown
                className={cn(
                  "size-3 transition-transform duration-200",
                  showClearMenu && "rotate-180"
                )}
                aria-hidden="true"
              />
            </Button>
          </div>

          {/* Clear options dropdown */}
          {showClearMenu && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowClearMenu(false)}
              />
              <div className="absolute end-0 top-full z-30 mt-1 w-48 rounded-xl border border-border bg-popover p-1 text-xs text-popover-foreground shadow-lg">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    onClearCategory()
                    setShowClearMenu(false)
                  }}
                  className="w-full justify-start gap-2 rounded-lg px-2.5 py-2 text-start text-xs hover:bg-destructive/10 hover:text-destructive"
                >
                  <IconTrash className="size-3.5" aria-hidden="true" />
                  <span>
                    {t("clearCategoryHistory", { category: categoryLabel })}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    onClearAll()
                    setShowClearMenu(false)
                  }}
                  className="w-full justify-start gap-2 rounded-lg px-2.5 py-2 text-start text-xs hover:bg-destructive/10 hover:text-destructive"
                >
                  <IconTrash className="size-3.5" aria-hidden="true" />
                  <span>{t("clearAllCategories")}</span>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Query chips: horizontally scrollable without breaking on phones */}
      {queries.length > 0 && (
        <div className="-mx-4 no-scrollbar flex items-center gap-1.5 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
          {queries.map((q) => (
            <div
              key={q}
              className="group inline-flex shrink-0 items-center rounded-full border border-border/60 bg-muted/30 text-xs font-normal text-foreground transition-all duration-150 hover:border-primary/40 hover:bg-muted/60"
            >
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onPress={() => onSelectQuery(q)}
                className="h-auto max-w-[200px] truncate rounded-s-full py-1 ps-3 pe-1.5 text-start font-normal text-foreground hover:bg-transparent hover:text-primary"
                aria-label={t("searchFor", { query: q })}
              >
                <span className="truncate">{q}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onPress={() => onRemoveQuery(q)}
                aria-label={t("removeRecentQuery", { query: q })}
                className="size-5 rounded-full p-0 pe-1 text-muted-foreground hover:bg-transparent hover:text-destructive"
              >
                <IconX className="size-3" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
