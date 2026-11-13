"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.049667, 0.0625, 0.196167, 0.356635] as const

/** Hover-reactive Aquarius zodiac emblem unpacked from Wallpaper Engine. */
export function AquariusIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/aquarius.png"
      swayMaskUrl="/images/reactive-icons/masks/aquarius.png"
      uvRect={UV_RECT}
      textureWidth={1001}
      textureHeight={1024}
      roughness={0.8}
      specularTint={0.69803922}
      {...props}
    />
  )
}
