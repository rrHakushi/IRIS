"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.180167, 0, 0.819833, 0.999111] as const

/** Hover-reactive Virgo character background unpacked from Wallpaper Engine. */
export function VirgoBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/virgo.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/virgo.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2106}
      roughness={0.8}
      specularTint={0.68235294}
      {...props}
    />
  )
}
