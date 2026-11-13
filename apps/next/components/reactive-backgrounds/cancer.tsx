"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.241667, 0, 0.758333, 0.999111] as const

/** Hover-reactive Cancer character background unpacked from Wallpaper Engine. */
export function CancerBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/cancer.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/cancer.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2277}
      roughness={0.82}
      specularTint={0.62352941}
      {...props}
    />
  )
}
