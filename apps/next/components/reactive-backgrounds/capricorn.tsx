"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.209333, 0, 0.790667, 0.999111] as const

/** Hover-reactive Capricorn character background unpacked from Wallpaper Engine. */
export function CapricornBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/capricorn.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/capricorn.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2184}
      roughness={0.85}
      specularTint={0.62352941}
      {...props}
    />
  )
}
