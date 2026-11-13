"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.187333, 0, 0.812667, 0.999111] as const

/** Hover-reactive Leo character background unpacked from Wallpaper Engine. */
export function LeoBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/leo.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/leo.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2125}
      roughness={0.85}
      specularTint={0.78431373}
      {...props}
    />
  )
}
