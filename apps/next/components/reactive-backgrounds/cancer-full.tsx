"use client"

import {
  ReactiveBackground,
  type ReactiveBackgroundVariantProps,
} from "./reactive-background"

const UV_RECT = [0.507084, 0, 0.492916, 0.999111] as const

/** Hover-reactive refined full-body Cancer character background in calligraphic wireframe style. */
export function CancerFullBackground(props: ReactiveBackgroundVariantProps) {
  return (
    <ReactiveBackground
      textureUrl="/images/reactive-backgrounds/cancer-full-v2.png"
      swayMaskUrl="/images/reactive-backgrounds/masks/cancer-full-v2.png"
      uvRect={UV_RECT}
      textureWidth={780}
      textureHeight={944}
      roughness={0.82}
      specularTint={0.62352941}
      {...props}
    />
  )
}

