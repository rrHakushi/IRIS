"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.026, 0.045912, 0.186, 0.317239] as const

/** Hover-reactive Capricorn zodiac emblem unpacked from Wallpaper Engine. */
export function CapricornIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/capricorn.png"
      swayMaskUrl="/images/reactive-icons/masks/capricorn.png"
      uvRect={UV_RECT}
      textureWidth={1024}
      textureHeight={983}
      roughness={0.85}
      specularTint={0.62352941}
      {...props}
    />
  )
}
