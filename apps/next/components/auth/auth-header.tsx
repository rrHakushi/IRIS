import React from "react"
import { cn } from "@workspace/ui/lib/utils"

interface AuthHeaderProps {
  title: string
  description: string
  className?: string
}

/**
 * Server-rendered header for authentication pages.
 */
export function AuthHeader({ title, description, className }: AuthHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 pb-1 text-center sm:gap-2",
        className
      )}
    >
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
        {title}
      </h1>
      <p className="text-xs text-balance text-muted-foreground sm:text-sm md:text-base">
        {description}
      </p>
    </div>
  )
}
