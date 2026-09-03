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
      className={cn("pt-1 text-center text-xs sm:text-sm", className)}
    >
      <span className="inline-block">{promptText}</span>{" "}
      <Link
        href={href}
        className="font-semibold whitespace-nowrap underline underline-offset-2 hover:underline"
      >
        {linkText}
      </Link>
    </FieldDescription>
  )
}
