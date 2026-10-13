"use client"

import { IconSparkles } from "@tabler/icons-react"

interface EmptyTabProps {
  type?: "recommendations"
}

export function EmptyTab({ type = "recommendations" }: EmptyTabProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 p-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
        <IconSparkles className="size-6" aria-hidden="true" />
      </div>

      <h3 className="text-sm font-semibold text-foreground">
        No Recommendations Yet
      </h3>

      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        Community recommendations and custom suggestions will appear here soon.
      </p>
    </div>
  )
}
