"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.243, 0, 0.757, 0.999111] as const

/** Hover-reactive Sagittarius character background unpacked from Wallpaper Engine. */
export function SagittariusBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/sagittarius.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/sagittarius.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2281}
      roughness={0.81}
      specularTint={0.6627451}
      {...props}
    />
  )
}
