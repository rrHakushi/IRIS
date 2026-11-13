"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.021167, 0.071386, 0.191, 0.328791] as const

/** Hover-reactive Pisces zodiac emblem unpacked from Wallpaper Engine. */
export function PiscesIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/pisces.png"
      swayMaskUrl="/images/reactive-icons/masks/pisces.png"
      uvRect={UV_RECT}
      textureWidth={1024}
      textureHeight={992}
      roughness={0.78}
      specularTint={0.8}
      {...props}
    />
  )
}
