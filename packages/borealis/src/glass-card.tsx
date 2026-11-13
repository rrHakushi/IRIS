import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

export type GlassCardVariant = "normal" | "tinted"

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassCardVariant
}

const variantClasses: Record<GlassCardVariant, string> = {
  normal:
    "border border-border/60 bg-card/70 text-card-foreground shadow-sm backdrop-blur-xl ring-1 ring-inset ring-foreground/[0.04]",
  tinted:
    "border border-white/25 bg-background/45 text-foreground shadow-2xl backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/20 dark:border-white/15 dark:bg-zinc-950/40 dark:text-zinc-100 dark:ring-white/10",
}

/**
 * Glassmorphic surface container for Borealis media pages.
 * - `normal`: Subtle translucent card surface for content & sidebar cards.
 * - `tinted`: Deep frosted glass surface matching BorealisCard for hero & featured containers.
 */
export function GlassCard({
  variant = "normal",
  className,
  ...props
}: GlassCardProps) {
  return (
    <div
      data-slot="glass-card"
      data-variant={variant}
      className={cn("rounded-2xl", variantClasses[variant], className)}
      {...props}
    />
  )
}

