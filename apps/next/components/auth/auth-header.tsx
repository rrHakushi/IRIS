import React from "react"
import { IconShieldLock } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"

interface AuthHeaderProps {
  title: string
  description: string
  badgeText?: string
  className?: string
}

/**
 * Server-rendered header for authentication pages.
 */
export function AuthHeader({
  title,
  description,
  badgeText,
  className,
}: AuthHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2.5 text-start",
        className
      )}
    >
      {badgeText && (
        <Badge
          variant="secondary"
          className="gap-1.5 rounded-full border border-border/70 bg-muted/70 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          <IconShieldLock className="size-3.5 text-foreground/80" />
          <span>{badgeText}</span>
        </Badge>
      )}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="text-xs leading-relaxed text-balance text-muted-foreground sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  )
}
