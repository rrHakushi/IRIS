"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.160667, 0, 0.839333, 0.999111] as const

/** Hover-reactive Gemini character background unpacked from Wallpaper Engine. */
export function GeminiBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/gemini.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/gemini.png"
      uvRect={UV_RECT}
      textureWidth={3072}
      textureHeight={2058}
      roughness={0.83}
      specularTint={1}
      {...props}
    />
  )
}
