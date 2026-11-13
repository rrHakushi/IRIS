"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.243167, 0, 0.756833, 0.999111] as const

/** Hover-reactive Taurus character background unpacked from Wallpaper Engine. */
export function TaurusBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/taurus.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/taurus.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2282}
      roughness={0.82}
      specularTint={0}
      {...props}
    />
  )
}
