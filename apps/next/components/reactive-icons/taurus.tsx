"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.029667, 0.021327, 0.189833, 0.379147] as const

/** Hover-reactive Taurus zodiac emblem unpacked from Wallpaper Engine. */
export function TaurusIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/taurus.png"
      swayMaskUrl="/images/reactive-icons/masks/taurus.png"
      uvRect={UV_RECT}
      textureWidth={911}
      textureHeight={1024}
      roughness={0.82}
      specularTint={0}
      {...props}
    />
  )
}
