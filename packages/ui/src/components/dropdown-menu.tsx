"use client"

import * as React from "react"
import {
  MenuTrigger as MenuTriggerPrimitive,
  Popover as PopoverPrimitive,
  Link as LinkPrimitive,
} from "react-aria-components"
import { cn } from "@workspace/ui/lib/utils"
import { IconCheck, IconChevronRight } from "@tabler/icons-react"

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof MenuTriggerPrimitive>) {
  return <MenuTriggerPrimitive data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenu({
  placement = "bottom start",
  offset = 6,
  crossOffset = 0,
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive>) {
  return (
    <PopoverPrimitive
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      className={cn(
        "z-50 min-w-56 overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-2xl outline-hidden backdrop-blur-2xl duration-100",
        "data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {children}
    </PopoverPrimitive>
  )
}

function DropdownMenuGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-group"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
}) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2.5 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase",
        inset && "ps-7",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onAction,
  onClick,
  href,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
  variant?: "default" | "destructive"
  onAction?: () => void
  onClick?: React.MouseEventHandler<HTMLElement>
  href?: string
}) {
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    onClick?.(e)
    onAction?.()
  }

  const itemContent = (
    <div
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      onClick={handleClick}
      className={cn(
        "group/dropdown-menu-item relative flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-hidden transition-colors select-none",
        "hover:bg-muted/80 hover:text-foreground focus:bg-muted/80 focus:text-foreground active:bg-muted/90",
        inset && "ps-7",
        variant === "destructive" &&
          "text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )

  if (href) {
    return (
      <LinkPrimitive
        href={href}
        className="block text-inherit no-underline outline-none"
      >
        {itemContent}
      </LinkPrimitive>
    )
  }

  return itemContent
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border/60", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ms-auto text-[10px] tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenuTrigger,
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
}
