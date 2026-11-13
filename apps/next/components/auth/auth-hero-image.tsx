"use client"

import React from "react"
import dynamic from "next/dynamic"

const LazyCancerBackground = dynamic(
  () =>
    import("@/components/reactive-backgrounds/cancer").then(
      (mod) => mod.CancerBackground
    ),
  { ssr: false }
)

const DEFAULT_VIEW_OPTIONS = {
  enabled: true,
  anchor: "bottom-right",
  zoom: 165,
  panX: 12,
  panY: 0,
  rotation: 0,
  tiltX: 0,
  tiltY: -8,
  flipX: false,
} as const

const FULL_ILLUMINATION_OPTIONS = {
  enabled: true,
  ambient: 100,
  mode: "hover",
  focusX: 55,
  focusY: 25,
  radius: 42,
  softness: 65,
  intensity: 140,
  tint: "white",
} as const

/**
 * Desktop-only lazy-loaded reactive Cancer hero stage.
 * Avoids loading Three.js and texture assets on mobile viewports (< 768px).
 */
export function AuthHeroImage() {
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)")
    const updateMatch = () => setIsDesktop(mediaQuery.matches)

    updateMatch()
    mediaQuery.addEventListener("change", updateMatch)
    return () => mediaQuery.removeEventListener("change", updateMatch)
  }, [])

  return (
    <div className="relative hidden overflow-hidden border-s border-border/50 bg-black select-none md:block">
      {isDesktop ? (
        <div className="absolute inset-0">
          <LazyCancerBackground
            className="h-full w-full"
            animated={true}
            playbackRate={100}
            imageFilter="none"
            viewOptions={DEFAULT_VIEW_OPTIONS}
            lightingOptions={FULL_ILLUMINATION_OPTIONS}
          />
        </div>
      ) : null}

      {/* Subtle vignette blending the black canvas into the card edge */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
    </div>
  )
}
