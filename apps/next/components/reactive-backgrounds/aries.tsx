"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.241167, 0, 0.758833, 0.999111] as const

/** Hover-reactive Aries character background unpacked from Wallpaper Engine. */
export function AriesBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/aries.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/aries.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2276}
      roughness={0.82}
      specularTint={0.64705882}
      {...props}
    />
  )
}
