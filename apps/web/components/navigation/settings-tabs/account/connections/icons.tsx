"use client"

import React, { useState } from "react"

const LOCAL_PROVIDER_MAP: Record<string, string> = {
  ANILIST: "/icons/connections/anilist.svg",
  MAL: "/icons/connections/myanimelist.svg",
  MYANIMELIST: "/icons/connections/myanimelist.svg",
  SIMKL: "/icons/connections/simkl.svg",
  BANGUMI: "/icons/connections/bangumi.svg",
  BGM: "/icons/connections/bangumi.svg",
  STEAM: "/icons/connections/steam.svg",
  RIOT_GAMES: "/icons/connections/riotgames.svg",
  RIOTGAMES: "/icons/connections/riotgames.svg",
  RIOT: "/icons/connections/riotgames.svg",
  RADARR: "/icons/connections/radarr.svg",
  SONARR: "/icons/connections/sonarr.svg",
  DEEZER: "/icons/connections/deezer.svg",
  LASTFM: "/icons/connections/lastfm.svg",
  SPOTIFY: "/icons/connections/spotify.svg",
  DISCORD: "/icons/connections/discord.svg",
  GITHUB: "/icons/connections/github.svg",
  IRIS: "/iris512left-ring.png",
}

export function getProviderIcon(
  provider?: string | null,
  fallbackIconUrl?: string | null
): string | null {
  if (!provider) return fallbackIconUrl || null
  const norm = provider.toUpperCase().replace(/[-_\s]/g, "")
  return (
    LOCAL_PROVIDER_MAP[norm] ||
    LOCAL_PROVIDER_MAP[provider.toUpperCase()] ||
    fallbackIconUrl ||
    null
  )
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
  const resolvedUrl = getProviderIcon(provider, iconUrl)

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
      {(provider || "").slice(0, 2).toUpperCase()}
    </div>
  )
}


