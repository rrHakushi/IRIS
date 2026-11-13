"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.038, 0.074348, 0.2155, 0.249111] as const

/** Hover-reactive Libra zodiac emblem unpacked from Wallpaper Engine. */
export function LibraIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/libra.png"
      swayMaskUrl="/images/reactive-icons/masks/libra.png"
      uvRect={UV_RECT}
      textureWidth={1024}
      textureHeight={666}
      roughness={0.85}
      specularTint={0.57254902}
      {...props}
    />
  )
}
