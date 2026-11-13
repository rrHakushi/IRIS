"use client"

import { ReactiveIcon, type ReactiveIconVariantProps } from "./reactive-icon"

const UV_RECT = [0.052667, 0.051244, 0.158, 0.363152] as const

/** Hover-reactive Sagittarius zodiac emblem unpacked from Wallpaper Engine. */
export function SagittariusIcon(props: ReactiveIconVariantProps) {
  return (
    <ReactiveIcon
      textureUrl="/images/reactive-icons/sagittarius.png"
      swayMaskUrl="/images/reactive-icons/masks/sagittarius.png"
      uvRect={UV_RECT}
      textureWidth={792}
      textureHeight={1024}
      roughness={0.81}
      specularTint={0.6627451}
      {...props}
    />
  )
}
