"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.035333, 0.016884, 0.168333, 0.422393] as const

/** Hover-reactive Gemini zodiac emblem unpacked from Wallpaper Engine. */
export function GeminiIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/gemini.png"
      swayMaskUrl="/images/reactive-icons/masks/gemini.png"
      uvRect={UV_RECT}
      textureWidth={725}
      textureHeight={1024}
      roughness={0.83}
      specularTint={1}
      {...props}
    />
  )
}
