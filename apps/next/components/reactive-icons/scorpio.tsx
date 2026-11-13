"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.025667, 0, 0.228, 0.416765] as const

/** Hover-reactive Scorpio zodiac emblem unpacked from Wallpaper Engine. */
export function ScorpioIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/scorpio.png"
      swayMaskUrl="/images/reactive-icons/masks/scorpio.png"
      uvRect={UV_RECT}
      textureWidth={996}
      textureHeight={1024}
      roughness={0.82}
      specularTint={0.65}
      {...props}
    />
  )
}
