"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.032667, 0.088863, 0.143833, 0.286137] as const

/** Hover-reactive Leo zodiac emblem unpacked from Wallpaper Engine. */
export function LeoIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/leo.png"
      swayMaskUrl="/images/reactive-icons/masks/leo.png"
      uvRect={UV_RECT}
      textureWidth={863}
      textureHeight={966}
      roughness={0.85}
      specularTint={0.78431373}
      {...props}
    />
  )
}
