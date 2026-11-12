import * as React from "react"
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

export interface BorealisSectionHeaderProps {
  title: React.ReactNode
  count?: number | string
  icon?: React.ComponentType<{ className?: string }>
  isCollapsed?: boolean
  onToggle?: () => void
  actions?: React.ReactNode
  className?: string
  headerClassName?: string
  buttonClassName?: string
  children?: React.ReactNode
}

/**
 * Collapsible section header / dropdown used across Borealis list pages and homepage.
 * Renders an accordion toggle with chevron, optional category icon, title, count pill,
 * and optional actions. Can be used as a standalone header or as a collapsible section wrapper.
 */
export function BorealisSectionHeader({
  title,
  count,
  icon: Icon,
  isCollapsed = false,
  onToggle,
  actions,
  className,
  headerClassName,
  buttonClassName,
  children,
}: BorealisSectionHeaderProps) {
  const header = (
    <div
      className={cn(
        "flex items-center justify-between border-b border-frost/60 pb-2 select-none",
        headerClassName
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        className={cn(
          "flex items-center gap-2.5 text-start font-heading text-sm font-bold tracking-tight text-zinc-100 hover:text-white transition-colors cursor-pointer select-none group",
          buttonClassName
        )}
      >
        <span className="flex size-6 items-center justify-center rounded-lg border border-frost bg-zinc-900/60 text-zinc-400 group-hover:border-zinc-500 group-hover:text-zinc-200 transition-colors">
          {isCollapsed ? (
            <IconChevronRight className="size-3.5" />
          ) : (
            <IconChevronDown className="size-3.5" />
          )}
        </span>
        {Icon && <Icon className="size-4 text-primary shrink-0" />}
        <span>{title}</span>
        {count !== undefined && (
          <span className="inline-flex items-center rounded-full border border-frost bg-zinc-900/60 px-2 py-0.5 font-mono text-[11px] font-medium text-zinc-300 tabular-nums">
            {count}
          </span>
        )}
      </button>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )

  if (children !== undefined) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {header}
        {!isCollapsed && children}
      </div>
    )
  }

  return header
}

export const BorealisSectionDropdown = BorealisSectionHeader

