"use client"

import React, { useState } from "react"

const PROVIDER_CDN_MAP: Record<string, string> = {
  ANILIST: "https://cdn.simpleicons.org/anilist/02A9FF",
  MAL: "https://cdn.simpleicons.org/myanimelist/2E51A2",
  MYANIMELIST: "https://cdn.simpleicons.org/myanimelist/2E51A2",
  SIMKL: "https://cdn.simpleicons.org/simkl/white",
  BANGUMI: "https://cdn.simpleicons.org/bangumi/F09199",
  BGM: "https://cdn.simpleicons.org/bangumi/F09199",
  STEAM: "https://cdn.simpleicons.org/steam/white",
  RIOT_GAMES: "https://cdn.simpleicons.org/riotgames/D13639",
  RIOTGAMES: "https://cdn.simpleicons.org/riotgames/D13639",
  RIOT: "https://cdn.simpleicons.org/riotgames/D13639",
  RADARR: "https://cdn.simpleicons.org/radarr/FFC230",
  SONARR: "https://cdn.simpleicons.org/sonarr/00CDF0",
  DEEZER: "https://cdn.simpleicons.org/deezer/A238FF",
  LASTFM: "https://cdn.simpleicons.org/lastdotfm/D51007",
  SPOTIFY: "https://cdn.simpleicons.org/spotify/1ED760",
  DISCORD: "https://cdn.simpleicons.org/discord/5865F2",
  GITHUB: "https://cdn.simpleicons.org/github/white",
}

export interface ProviderIconProps {
  provider: string
  iconUrl?: string | null
  className?: string
}

export function ProviderIcon({
  provider,
  iconUrl,
  className = "size-5",
}: ProviderIconProps): React.JSX.Element {
  const [error, setError] = useState(false)
  const norm = (provider || "").toUpperCase().replace(/[-_\s]/g, "")
  const resolvedUrl =
    iconUrl ||
    PROVIDER_CDN_MAP[norm] ||
    PROVIDER_CDN_MAP[provider?.toUpperCase()]

  if (resolvedUrl && !error) {
    return (
      <img
        src={resolvedUrl}
        alt={provider}
        className={`${className} object-contain`}
        loading="lazy"
        onError={() => setError(true)}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-md bg-muted text-[10px] font-bold text-foreground select-none ${className}`}
    >
      {provider.slice(0, 2).toUpperCase()}
    </div>
  )
}

