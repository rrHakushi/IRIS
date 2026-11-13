"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.026, 0.042062, 0.2095, 0.316943] as const

/** Hover-reactive Virgo zodiac emblem unpacked from Wallpaper Engine. */
export function VirgoIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/virgo.png"
      swayMaskUrl="/images/reactive-icons/masks/virgo.png"
      uvRect={UV_RECT}
      textureWidth={1024}
      textureHeight={872}
      roughness={0.8}
      specularTint={0.68235294}
      {...props}
    />
  )
}
