import type {
  LightingMode,
  LightingOptions,
  LightTintPreset,
  ReactiveSurfaceLayout,
  ViewOptions,
} from "../../../../components/reactive-backgrounds"

export const DEFAULT_VIEW_OPTIONS: Required<ViewOptions> = {
  enabled: true,
  anchor: "bottom-right",
  zoom: 100,
  panX: 0,
  panY: 0,
  rotation: 0,
  tiltX: 0,
  tiltY: 0,
  flipX: false,
}

export const DEFAULT_LIGHTING_OPTIONS: Required<LightingOptions> = {
  enabled: true,
  ambient: 100,
  mode: "hover",
  focusX: 55,
  focusY: 25,
  radius: 42,
  softness: 65,
  intensity: 140,
  tint: "white",
}

export interface OptionItem<T extends string> {
  id: T
  label: string
}

export const ANCHOR_OPTIONS: ReadonlyArray<OptionItem<ReactiveSurfaceLayout>> =
  [
    { id: "bottom-right", label: "Bottom Right" },
    { id: "bottom-left", label: "Bottom Left" },
    { id: "center", label: "Center" },
    { id: "top-center", label: "Top Center" },
  ]

export const LIGHT_MODE_OPTIONS: ReadonlyArray<OptionItem<LightingMode>> = [
  { id: "hover", label: "Hover Flashlight" },
  { id: "spot", label: "Pinned Spot" },
  { id: "scan-vertical", label: "Vertical Scan" },
  { id: "scan-orbit", label: "Orbit Spotlight" },
  { id: "dual-bands", label: "Dual Shimmer" },
]

export const LIGHT_TINT_OPTIONS: ReadonlyArray<OptionItem<LightTintPreset>> = [
  { id: "white", label: "Pure White" },
  { id: "coral", label: "Coral Crab" },
  { id: "moonlight", label: "Moonlight" },
  { id: "gold", label: "Celestial Gold" },
  { id: "violet", label: "Amethyst" },
]

export interface ViewPreset {
  id: string
  label: string
  options: Omit<Required<ViewOptions>, "enabled">
}

export const VIEW_PRESETS: readonly ViewPreset[] = [
  {
    id: "default",
    label: "Default · Bottom Right",
    options: {
      anchor: "bottom-right",
      zoom: 100,
      panX: 0,
      panY: 0,
      rotation: 0,
      tiltX: 0,
      tiltY: 0,
      flipX: false,
    },
  },
  {
    id: "mirrored-left",
    label: "Mirrored · Bottom Left",
    options: {
      anchor: "bottom-left",
      zoom: 100,
      panX: 0,
      panY: 0,
      rotation: 0,
      tiltX: 0,
      tiltY: 0,
      flipX: true,
    },
  },
  {
    id: "center-full",
    label: "Centered Full",
    options: {
      anchor: "center",
      zoom: 100,
      panX: 0,
      panY: 0,
      rotation: 0,
      tiltX: 0,
      tiltY: 0,
      flipX: false,
    },
  },
  {
    id: "crown-crab",
    label: "Portrait & Crab Close-Up",
    options: {
      anchor: "center",
      zoom: 190,
      panX: 12,
      panY: -78,
      rotation: -6,
      tiltX: 0,
      tiltY: -10,
      flipX: false,
    },
  },
  {
    id: "waist-filigree",
    label: "Corset & Hip Filigree",
    options: {
      anchor: "center",
      zoom: 215,
      panX: 10,
      panY: -30,
      rotation: 8,
      tiltX: 6,
      tiltY: -14,
      flipX: false,
    },
  },
  {
    id: "legs-ribbons",
    label: "Legs & Shin Ribbons",
    options: {
      anchor: "center",
      zoom: 195,
      panX: 8,
      panY: 54,
      rotation: -8,
      tiltX: -6,
      tiltY: 12,
      flipX: false,
    },
  },
  {
    id: "floating-diagonal",
    label: "Floating Diagonal",
    options: {
      anchor: "center",
      zoom: 96,
      panX: 14,
      panY: 0,
      rotation: -22,
      tiltX: 10,
      tiltY: -18,
      flipX: false,
    },
  },
  {
    id: "perspective-stage",
    label: "3D Perspective Stage",
    options: {
      anchor: "bottom-right",
      zoom: 108,
      panX: -6,
      panY: 2,
      rotation: 4,
      tiltX: 18,
      tiltY: -28,
      flipX: false,
    },
  },
] as const

export interface LightPreset {
  id: string
  label: string
  options: Omit<Required<LightingOptions>, "enabled">
}

export const LIGHT_PRESETS: readonly LightPreset[] = [
  {
    id: "default",
    label: "Full Illumination",
    options: {
      ambient: 100,
      mode: "hover",
      focusX: 55,
      focusY: 25,
      radius: 42,
      softness: 65,
      intensity: 140,
      tint: "white",
    },
  },
  {
    id: "hover-flashlight",
    label: "Hover Flashlight",
    options: {
      ambient: 14,
      mode: "hover",
      focusX: 55,
      focusY: 25,
      radius: 42,
      softness: 65,
      intensity: 140,
      tint: "white",
    },
  },
  {
    id: "crown-crab",
    label: "Crown & Crab Spot",
    options: {
      ambient: 18,
      mode: "spot",
      focusX: 55,
      focusY: 25,
      radius: 32,
      softness: 62,
      intensity: 165,
      tint: "coral",
    },
  },
  {
    id: "torso-filigree",
    label: "Corset & Hip Filigree",
    options: {
      ambient: 18,
      mode: "spot",
      focusX: 52,
      focusY: 42,
      radius: 28,
      softness: 58,
      intensity: 170,
      tint: "gold",
    },
  },
  {
    id: "legs-ribbons",
    label: "Legs & Shin Ribbons",
    options: {
      ambient: 16,
      mode: "spot",
      focusX: 48,
      focusY: 69,
      radius: 34,
      softness: 60,
      intensity: 165,
      tint: "moonlight",
    },
  },
  {
    id: "scan-vertical",
    label: "Vertical Body Scan",
    options: {
      ambient: 18,
      mode: "scan-vertical",
      focusX: 52,
      focusY: 50,
      radius: 28,
      softness: 65,
      intensity: 155,
      tint: "white",
    },
  },
  {
    id: "scan-orbit",
    label: "Orbiting Spotlight",
    options: {
      ambient: 20,
      mode: "scan-orbit",
      focusX: 52,
      focusY: 48,
      radius: 34,
      softness: 68,
      intensity: 155,
      tint: "coral",
    },
  },
  {
    id: "dual-bands",
    label: "Dual Shimmer Sweep",
    options: {
      ambient: 22,
      mode: "dual-bands",
      focusX: 52,
      focusY: 50,
      radius: 26,
      softness: 65,
      intensity: 140,
      tint: "violet",
    },
  },
] as const
