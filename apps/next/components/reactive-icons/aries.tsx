"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.018333, 0.022512, 0.218333, 0.336493] as const

/** Hover-reactive Aries zodiac emblem unpacked from Wallpaper Engine. */
export function AriesIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/aries.png"
      swayMaskUrl="/images/reactive-icons/masks/aries.png"
      uvRect={UV_RECT}
      textureWidth={1024}
      textureHeight={888}
      roughness={0.82}
      specularTint={0.64705882}
      {...props}
    />
  )
}
