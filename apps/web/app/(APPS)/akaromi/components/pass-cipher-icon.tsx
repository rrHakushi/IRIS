"use client"

import React, { useState } from "react"
import { IconKey, IconTerminal2 } from "@tabler/icons-react"
import { extractDomain, getFaviconUrl } from "@/lib/pass-matching"
import type { DecryptedCipher, DecryptedLoginData } from "@/lib/pass-types"

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
  const [imgError, setImgError] = useState(false)

  const isLogin = item.type === "LOGIN"
  const loginData = isLogin ? (item.data as DecryptedLoginData) : null

  // Try extracting domain from URLs, passkey rpId, or title
  const domain = isLogin
    ? extractDomain(
        loginData?.uris?.[0]?.uri ||
          loginData?.passkey?.rpId ||
          (item.title.includes(".") ? item.title : null)
      )
    : null

  const faviconUrl = !imgError && domain ? getFaviconUrl(domain) : null

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

  return (
    <div
      className={`${containerSizes[size]} flex shrink-0 items-center justify-center overflow-hidden bg-[#d800a6]/10 text-[#d800a6] ${
        !isLogin ? "bg-emerald-500/10 text-emerald-500" : ""
      } ${className}`}
    >
      {faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          className={`${iconSizes[size]} rounded-xs object-contain`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : isLogin ? (
        <IconKey className={iconSizes[size]} />
      ) : (
        <IconTerminal2 className={iconSizes[size]} />
      )}
    </div>
  )
}
