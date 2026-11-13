"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.208, 0, 0.792, 0.999111] as const

/** Hover-reactive Pisces character background unpacked from Wallpaper Engine. */
export function PiscesBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/pisces.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/pisces.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2181}
      roughness={0.78}
      specularTint={0.8}
      {...props}
    />
  )
}
