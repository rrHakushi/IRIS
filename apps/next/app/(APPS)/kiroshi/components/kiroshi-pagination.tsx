"use client"

import React, { memo } from "react"
import { Button } from "@workspace/ui/components/button"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

export interface KiroshiPaginationProps {
  currentPage: number
  isLoading: boolean
  onPageChange: (newPage: number) => void
  className?: string
}

export const KiroshiPagination = memo(function KiroshiPagination({
  currentPage,
  isLoading,
  onPageChange,
  className,
}: KiroshiPaginationProps): React.JSX.Element {
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex items-center justify-between border-t border-border/40 pt-4 pb-12 sm:pt-6 sm:pb-0",
        className
      )}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={currentPage <= 1 || isLoading}
        onClick={() => onPageChange(currentPage - 1)}
        className="gap-1 text-xs"
      >
        <IconChevronLeft className="size-3.5" />
        <span>Previous</span>
      </Button>

      <span className="text-xs text-muted-foreground font-mono">
        Page {currentPage}
      </span>

      <Button
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={() => onPageChange(currentPage + 1)}
        className="gap-1 text-xs"
      >
        <span>Next</span>
        <IconChevronRight className="size-3.5" />
      </Button>
    </nav>
  )
})
