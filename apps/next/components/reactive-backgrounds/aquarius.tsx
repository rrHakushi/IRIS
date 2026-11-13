"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.166833, 0, 0.833167, 0.999111] as const

/** Hover-reactive Aquarius character background unpacked from Wallpaper Engine. */
export function AquariusBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/aquarius.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/aquarius.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2073}
      roughness={0.8}
      specularTint={0.69803922}
      {...props}
    />
  )
}
