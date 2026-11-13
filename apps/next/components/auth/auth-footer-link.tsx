import React from "react"
import Link from "next/link"
import { FieldDescription } from "@workspace/ui/components/field"
import { cn } from "@workspace/ui/lib/utils"

interface AuthFooterLinkProps {
  promptText: string
  linkText: string
  href: string
  className?: string
}

/**
 * Server-rendered footer prompt and navigation link.
 */
export function AuthFooterLink({
  promptText,
  linkText,
  href,
  className,
}: AuthFooterLinkProps) {
  return (
    <FieldDescription
      className={cn(
        "border-t border-border/50 pt-4 text-center text-xs text-muted-foreground sm:text-sm",
        className
      )}
    >
      <span className="inline-block">{promptText}</span>{" "}
      <Link
        href={href}
        className="font-semibold whitespace-nowrap text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
      >
        {linkText}
      </Link>
    </FieldDescription>
  )
}
