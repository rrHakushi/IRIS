"use client"

import React from "react"
import Link from "next/link"
import { IconCompass, IconX, IconSearch } from "@tabler/icons-react"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { DiscoverCategory } from "./discover-types"

interface DiscoverEmptyStateProps {
  category: DiscoverCategory
  selectedGenre?: string
  onClearFilter?: () => void
}

export function DiscoverEmptyState({
  category,
  selectedGenre,
  onClearFilter,
}: DiscoverEmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center rounded-[min(var(--radius-4xl),24px)] border border-dashed border-border/60 bg-card/40 p-8 text-center sm:p-12">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
        <IconCompass className="size-6 opacity-70" />
      </div>

      <h3 className="font-heading text-base font-semibold text-foreground sm:text-lg">
        {selectedGenre
          ? `No ${category} found for "${selectedGenre}"`
          : `No ${category} discovered yet`}
      </h3>

      <p className="mt-1 max-w-md text-xs text-muted-foreground sm:text-sm">
        {selectedGenre
          ? "Try selecting another genre or clear your filter to browse all available releases."
          : `We haven't indexed enough ${category} titles yet. You can search directly or trigger a query in Browse.`}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {selectedGenre && onClearFilter ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onClearFilter}
            className="h-8 gap-1.5 rounded-2xl bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
          >
            <IconX className="size-3.5" />
            <span>Clear Filter</span>
          </Button>
        ) : null}

        <Link
          href={`/IRIS-list/browse?category=${category}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex h-8 items-center gap-1.5 rounded-2xl border-border px-3 text-xs"
          )}
        >
          <IconSearch className="size-3.5" />
          <span>Open Browse & Search</span>
        </Link>
      </div>
    </div>
  )
}
