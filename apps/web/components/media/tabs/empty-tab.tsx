"use client"

import React from "react"
import { IconMessageCircleOff, IconSparkles } from "@tabler/icons-react"

interface EmptyTabProps {
  type: "reviews" | "recommendations"
}

export function EmptyTab({ type }: EmptyTabProps) {
  const isReviews = type === "reviews"

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
        {isReviews ? (
          <IconMessageCircleOff className="size-6" aria-hidden="true" />
        ) : (
          <IconSparkles className="size-6" aria-hidden="true" />
        )}
      </div>

      <h3 className="text-sm font-semibold text-foreground">
        {isReviews ? "No Reviews Yet" : "No Recommendations Yet"}
      </h3>

      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {isReviews
          ? "User reviews and community impressions for this title will appear here once submitted."
          : "Community recommendations and custom suggestions will appear here soon."}
      </p>
    </div>
  )
}
