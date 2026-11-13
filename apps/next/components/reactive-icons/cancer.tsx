"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.048333, 0.068424, 0.153333, 0.275178] as const

/** Hover-reactive Cancer zodiac emblem unpacked from Wallpaper Engine. */
export function CancerIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/cancer.png"
      swayMaskUrl="/images/reactive-icons/masks/cancer.png"
      uvRect={UV_RECT}
      textureWidth={920}
      textureHeight={929}
      roughness={0.82}
      specularTint={0.62352941}
      {...props}
    />
  )
}
