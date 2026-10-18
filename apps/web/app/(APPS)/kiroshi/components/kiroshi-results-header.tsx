"use client"

import React, { memo } from "react"
import Link from "next/link"
import Image from "next/image"
import { KiroshiSearchInput } from "./kiroshi-search-input"
import { KiroshiCategoryTabs } from "./kiroshi-category-tabs"
import { KiroshiFilterToolbar } from "./kiroshi-filter-toolbar"
import { cn } from "@workspace/ui/lib/utils"

export interface KiroshiResultsHeaderProps {
  query: string
  activeCategory: string
  timeRange: string
  language: string
  safeSearch: string
  responseTimeMs?: number
  numberOfResults?: number
  onSubmitSearch: (newQuery: string) => void
  onSelectCategory: (categoryId: string) => void
  onChangeFilter: (key: "timeRange" | "language" | "safeSearch", value: string) => void
}

export const KiroshiResultsHeader = memo(function KiroshiResultsHeader({
  query,
  activeCategory,
  timeRange,
  language,
  safeSearch,
  responseTimeMs,
  numberOfResults,
  onSubmitSearch,
  onSelectCategory,
  onChangeFilter,
}: KiroshiResultsHeaderProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur-md">
      <div className="flex w-full flex-col gap-2 px-4 sm:px-6 lg:px-8 pt-2.5 sm:pt-3 pb-2">
        {/* Row 1: Logo + Compact Search Input */}
        <div className="flex items-center gap-3">
          <Link
            href="/kiroshi"
            className="shrink-0 transition-transform duration-200 hover:scale-105"
            title="Kiroshi Home"
          >
            <Image
              src="/iris-icons/iris-search-ring-left.png"
              alt="Kiroshi"
              width={36}
              height={36}
              className="size-8 sm:size-9 rounded-full object-contain"
            />
          </Link>

          <div className="flex-1 max-w-2xl min-w-0">
            <KiroshiSearchInput
              initialValue={query}
              variant="compact"
              placeholder="Search the web..."
              onSubmit={onSubmitSearch}
            />
          </div>
        </div>

        {/* Row 2: Category Tabs */}
        <KiroshiCategoryTabs
          activeCategory={activeCategory}
          onSelectCategory={onSelectCategory}
        />

        {/* Row 3: Minimalist Filters & Response Stats */}
        <KiroshiFilterToolbar
          timeRange={timeRange}
          language={language}
          safeSearch={safeSearch}
          responseTimeMs={responseTimeMs}
          numberOfResults={numberOfResults}
          onChangeFilter={onChangeFilter}
        />
      </div>
    </header>
  )
})
