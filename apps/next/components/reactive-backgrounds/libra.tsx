"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.215333, 0, 0.784667, 0.999111] as const

/** Hover-reactive Libra character background unpacked from Wallpaper Engine. */
export function LibraBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/libra.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/libra.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2201}
      roughness={0.85}
      specularTint={0.57254902}
      {...props}
    />
  )
}
