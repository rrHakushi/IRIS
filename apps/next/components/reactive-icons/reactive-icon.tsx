"use client"

import {
  ReactiveBackground,
  type ColorOptions,
  type ImageFilterPreset,
  type ReactiveBackgroundProps,
  type ReactiveBackgroundVariantProps,
} from "../reactive-backgrounds/reactive-background"

export type { ColorOptions, ImageFilterPreset }
export type ReactiveIconVariantProps = ReactiveBackgroundVariantProps

export type ReactiveIconProps = Omit<
  ReactiveBackgroundProps,
  "layout" | "transparent" | "worldSpan"
>

const ICON_WORLD_SPAN = 720

/** Hover-lit transparent zodiac emblem canvas sharing the Wallpaper Engine shader. */
export function ReactiveIcon(props: ReactiveIconProps) {
  return (
    <ReactiveBackground
      layout="contain-center"
      transparent
      worldSpan={ICON_WORLD_SPAN}
      {...props}
    />
  )
}
