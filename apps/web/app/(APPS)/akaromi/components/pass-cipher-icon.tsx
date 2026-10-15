"use client"

import React from "react"
import {
  IconKey,
  IconNote,
  IconCreditCard,
  IconTerminal2,
  IconId,
  IconFileText,
} from "@tabler/icons-react"
import type { DecryptedCipher } from "@/lib/pass-types"

interface CipherIconProps {
  item: DecryptedCipher
  size?: "sm" | "md" | "lg"
  className?: string
}

export function CipherIcon({
  item,
  size = "md",
  className = "",
}: CipherIconProps) {
  const subtype = item.data?.itemType || (item.type === "SSH_KEY" ? "ssh" : "login")

  const containerSizes = {
    sm: "size-8 rounded-lg",
    md: "size-10 rounded-xl",
    lg: "size-12 rounded-2xl",
  }

  const iconSizes = {
    sm: "size-4",
    md: "size-5",
    lg: "size-6",
  }

  let icon = <IconKey className={iconSizes[size]} />

  if (subtype === "note") {
    icon = <IconNote className={iconSizes[size]} />
  } else if (subtype === "card") {
    icon = <IconCreditCard className={iconSizes[size]} />
  } else if (subtype === "ssh") {
    icon = <IconTerminal2 className={iconSizes[size]} />
  } else if (subtype === "identity") {
    icon = <IconId className={iconSizes[size]} />
  } else if (subtype === "other") {
    icon = <IconFileText className={iconSizes[size]} />
  }

  return (
    <div
      className={`${containerSizes[size]} flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted/60 text-foreground ${className}`}
    >
      {icon}
    </div>
  )
}

