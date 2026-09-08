"use client"

import React from "react"
import Image from "next/image"
import { useAuthIllustration } from "./auth-illustration-context"

interface AuthHeroImageProps {
  fallbackSrc?: string
  alt?: string
}

export function AuthHeroImage({
  fallbackSrc = "/images/auth/character/login-default.jpg",
  alt = "IRIS Companion",
}: AuthHeroImageProps) {
  const { illustration } = useAuthIllustration()
  const [imgSrc, setImgSrc] = React.useState<string>(
    illustration || fallbackSrc
  )

  React.useEffect(() => {
    setImgSrc(illustration || fallbackSrc)
  }, [illustration, fallbackSrc])

  return (
    <div className="relative hidden overflow-hidden bg-black select-none md:block">
      <Image
        src={imgSrc}
        alt={alt}
        fill
        priority
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-contain p-2 transition-opacity duration-200 select-none"
        onError={() => setImgSrc(fallbackSrc)}
      />
    </div>
  )
}
