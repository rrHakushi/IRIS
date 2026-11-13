"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.157833, 0, 0.842167, 0.999111] as const

/** Hover-reactive Scorpio character background unpacked from Wallpaper Engine. */
export function ScorpioBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/scorpio.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/scorpio.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2051}
      roughness={0.82}
      specularTint={0.65}
      {...props}
    />
  )
}
