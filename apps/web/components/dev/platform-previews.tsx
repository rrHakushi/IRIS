"use client"

import React, { useState } from "react"
import {
  IconBrandDiscord,
  IconBrandX,
  IconBrandGoogle,
  IconBrandSlack,
  IconBrandFacebook,
  IconBrandTelegram,
  IconExternalLink,
  IconSun,
  IconMoon,
  IconPhoto,
} from "@tabler/icons-react"
import type { PageMetadataInfo, SocialPlatformId } from "./types"

interface PlatformPreviewsProps {
  metadata: PageMetadataInfo
  selectedPlatform: SocialPlatformId
  onSelectPlatform: (platform: SocialPlatformId) => void
}

export function PlatformPreviews({
  metadata,
  selectedPlatform,
  onSelectPlatform,
}: PlatformPreviewsProps) {
  const platforms: Array<{
    id: SocialPlatformId
    name: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    { id: "discord", name: "Discord", icon: IconBrandDiscord },
    { id: "twitter", name: "Twitter / X", icon: IconBrandX },
    { id: "google", name: "Google SERP", icon: IconBrandGoogle },
    { id: "slack", name: "Slack", icon: IconBrandSlack },
    { id: "facebook", name: "Facebook & LinkedIn", icon: IconBrandFacebook },
    { id: "telegram", name: "Telegram", icon: IconBrandTelegram },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Platform Selector Chips */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-border/50 bg-muted/60 p-1">
        {platforms.map((p) => {
          const Icon = p.icon
          const isActive = selectedPlatform === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPlatform(p.id)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? "border border-border/60 bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{p.name}</span>
            </button>
          )
        })}
      </div>

      {/* Active Platform Preview */}
      <div className="pt-1">
        {selectedPlatform === "discord" && (
          <DiscordPreview metadata={metadata} />
        )}
        {selectedPlatform === "twitter" && (
          <TwitterPreview metadata={metadata} />
        )}
        {selectedPlatform === "google" && <GooglePreview metadata={metadata} />}
        {selectedPlatform === "slack" && <SlackPreview metadata={metadata} />}
        {selectedPlatform === "facebook" && (
          <FacebookPreview metadata={metadata} />
        )}
        {selectedPlatform === "telegram" && (
          <TelegramPreview metadata={metadata} />
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Discord Preview                                                            */
/* -------------------------------------------------------------------------- */
function DiscordPreview({ metadata }: { metadata: PageMetadataInfo }) {
  const embedColor = metadata.themeColor || "#5865F2"
  const title = metadata.openGraph.title || metadata.title || "IRIS"
  const description =
    metadata.openGraph.description ||
    metadata.description ||
    "No description provided."
  const image = metadata.openGraph.image || metadata.twitter.image
  const siteName = metadata.openGraph.siteName || "IRIS"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="text-[11px] font-semibold tracking-wider uppercase">
          Discord Embed Card
        </span>
        <span className="flex items-center gap-1 text-[11px]">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: embedColor }}
          />
          Accent: {embedColor}
        </span>
      </div>

      {/* Discord message container */}
      <div className="rounded-xl border border-[#1e1f22] bg-[#313338] p-4 font-sans text-sm text-[#dbdee1] shadow-md">
        {/* Message author simulation */}
        <div className="mb-2 flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-[#5865F2] text-[10px] font-bold text-white">
            U
          </div>
          <span className="text-xs font-medium text-[#f2f3f5]">User</span>
          <span className="text-[10px] text-[#949ba4]">Today at 12:00 PM</span>
        </div>

        {/* Message content */}
        <div className="mb-2 text-xs break-all text-[#00a8fc] underline">
          {metadata.url || "https://iris.local/media/..."}
        </div>

        {/* Embed Box */}
        <div
          className="flex max-w-[440px] flex-col gap-2 rounded-lg border-s-[4px] bg-[#2b2d31] p-3.5 text-xs shadow-sm"
          style={{ borderLeftColor: embedColor }}
        >
          {/* Provider / Site Name */}
          <div className="text-[11px] font-medium tracking-wide text-[#949ba4]">
            {siteName}
          </div>

          {/* Title */}
          <div className="cursor-pointer text-sm leading-snug font-semibold text-[#00a8fc] hover:underline">
            {title}
          </div>

          {/* Description */}
          <div className="line-clamp-4 text-xs leading-relaxed whitespace-pre-wrap text-[#dbdee1]">
            {description}
          </div>

          {/* Media image */}
          {image ? (
            <div className="mt-1 max-h-[260px] overflow-hidden rounded-md border border-[#35373c] bg-[#1e1f22]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={title}
                className="h-full max-h-[260px] w-full object-cover"
                onError={(e) => {
                  ;(e.currentTarget as HTMLElement).style.display = "none"
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded bg-[#1e1f22] p-3 text-[11px] text-[#949ba4] italic">
              <IconPhoto className="size-3.5" /> No image attached (missing
              og:image)
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Twitter / X Preview                                                        */
/* -------------------------------------------------------------------------- */
function TwitterPreview({ metadata }: { metadata: PageMetadataInfo }) {
  const [cardMode, setCardMode] = useState<"summary_large_image" | "summary">(
    metadata.twitter.card === "summary" ? "summary" : "summary_large_image"
  )

  const title = metadata.twitter.title || metadata.title || "IRIS"
  const description =
    metadata.twitter.description ||
    metadata.description ||
    "No description provided."
  const image = metadata.twitter.image || metadata.openGraph.image
  const domain =
    typeof window !== "undefined" ? window.location.hostname : "iris.local"

  return (
    <div className="flex flex-col gap-3">
      {/* Switcher & info */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          X / Twitter Card
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setCardMode("summary_large_image")}
            className={`rounded px-2 py-0.5 font-medium transition-all ${
              cardMode === "summary_large_image"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground"
            }`}
          >
            Large Image
          </button>
          <button
            type="button"
            onClick={() => setCardMode("summary")}
            className={`rounded px-2 py-0.5 font-medium transition-all ${
              cardMode === "summary"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground"
            }`}
          >
            Summary Card
          </button>
        </div>
      </div>

      {/* Twitter container (Dark mode authentic) */}
      <div className="rounded-xl border border-[#2f3336] bg-[#000000] p-4 font-sans text-[#e7e9ea] shadow-md">
        {/* Author row */}
        <div className="mb-2.5 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-[#1d9bf0] text-xs font-bold text-white">
            X
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs font-bold">
              Account{" "}
              <span className="font-normal text-[#71767b]">@user · 1m</span>
            </div>
            <div className="cursor-pointer text-xs text-[#1d9bf0] hover:underline">
              {metadata.url}
            </div>
          </div>
        </div>

        {/* Card UI */}
        {cardMode === "summary_large_image" ? (
          <div className="max-w-[460px] cursor-pointer overflow-hidden rounded-2xl border border-[#2f3336] bg-[#000000] transition-colors hover:bg-[#030303]">
            {image ? (
              <div className="relative aspect-[1.91/1] w-full overflow-hidden bg-[#16181c]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-[1.91/1] w-full items-center justify-center gap-1.5 bg-[#16181c] text-xs text-[#71767b]">
                <IconPhoto className="size-4" /> No twitter:image or og:image
              </div>
            )}
            <div className="flex flex-col gap-0.5 p-3">
              <div className="truncate text-[12px] text-[#71767b]">
                {domain}
              </div>
              <div className="line-clamp-1 text-sm font-bold text-[#e7e9ea]">
                {title}
              </div>
              <div className="line-clamp-2 text-xs leading-relaxed text-[#71767b]">
                {description}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex max-w-[460px] cursor-pointer overflow-hidden rounded-2xl border border-[#2f3336] bg-[#000000] transition-colors hover:bg-[#030303]">
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 p-3">
              <div className="truncate text-[12px] text-[#71767b]">
                {domain}
              </div>
              <div className="line-clamp-1 text-sm font-bold text-[#e7e9ea]">
                {title}
              </div>
              <div className="line-clamp-2 text-xs leading-relaxed text-[#71767b]">
                {description}
              </div>
            </div>
            {image ? (
              <div className="size-24 shrink-0 border-s border-[#2f3336] bg-[#16181c]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex size-24 shrink-0 items-center justify-center border-s border-[#2f3336] bg-[#16181c] text-[10px] text-[#71767b]">
                No image
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Google Search Result (SERP) Preview                                        */
/* -------------------------------------------------------------------------- */
function GooglePreview({ metadata }: { metadata: PageMetadataInfo }) {
  const [isDarkMode, setIsDarkMode] = useState(true)

  const title = metadata.title || "IRIS - Self-Hosted Suite"
  const description =
    metadata.description ||
    "Detailed page description. Provide informative text to help search engines accurately snippet your page content."
  const domain =
    typeof window !== "undefined" ? window.location.hostname : "iris.local"
  const pathname = metadata.pathname || "/"

  // Breadcrumb path simulation
  const breadcrumb = `${domain} › ${pathname
    .split("/")
    .filter(Boolean)
    .join(" › ")}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Google SERP Preview
        </span>
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {isDarkMode ? (
            <IconSun className="size-3" />
          ) : (
            <IconMoon className="size-3" />
          )}
          <span>{isDarkMode ? "Light SERP" : "Dark SERP"}</span>
        </button>
      </div>

      {/* SERP Card */}
      <div
        className={`rounded-xl border p-4 font-sans shadow-sm transition-colors ${
          isDarkMode
            ? "border-[#303134] bg-[#202124] text-[#e8eaed]"
            : "border-[#dadce0] bg-[#ffffff] text-[#202124]"
        }`}
      >
        {/* Favicon & Breadcrumb */}
        <div className="mb-1 flex items-center gap-2">
          <div
            className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
              isDarkMode
                ? "bg-[#303134] text-white"
                : "bg-[#f1f3f4] text-gray-700"
            }`}
          >
            I
          </div>
          <div className="flex flex-col">
            <span
              className={`text-xs leading-none font-medium ${
                isDarkMode ? "text-[#bdc1c6]" : "text-[#202124]"
              }`}
            >
              {metadata.openGraph.siteName || "IRIS"}
            </span>
            <span
              className={`max-w-[380px] truncate text-[11px] leading-tight ${
                isDarkMode ? "text-[#9aa0a6]" : "text-[#4d5156]"
              }`}
            >
              {breadcrumb}
            </span>
          </div>
        </div>

        {/* Title link */}
        <div
          className={`mb-1 line-clamp-1 cursor-pointer text-[18px] leading-snug font-normal hover:underline ${
            isDarkMode ? "text-[#8ab4f8]" : "text-[#1a0dab]"
          }`}
        >
          {title}
        </div>

        {/* Snippet */}
        <div
          className={`line-clamp-2 text-xs leading-relaxed ${
            isDarkMode ? "text-[#bdc1c6]" : "text-[#4d5156]"
          }`}
        >
          {description}
        </div>
      </div>

      {/* Length metrics */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-2.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Title Length</span>
            <span className="font-mono">{title.length} / 60</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                title.length > 60
                  ? "bg-amber-500"
                  : title.length >= 30
                    ? "bg-emerald-500"
                    : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(100, (title.length / 60) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-2.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Description Length</span>
            <span className="font-mono">{description.length} / 160</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${
                description.length > 160
                  ? "bg-amber-500"
                  : description.length >= 50
                    ? "bg-emerald-500"
                    : "bg-blue-500"
              }`}
              style={{
                width: `${Math.min(100, (description.length / 160) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Slack Unfurl Preview                                                       */
/* -------------------------------------------------------------------------- */
function SlackPreview({ metadata }: { metadata: PageMetadataInfo }) {
  const title = metadata.openGraph.title || metadata.title || "IRIS"
  const description =
    metadata.openGraph.description ||
    metadata.description ||
    "No description provided."
  const image = metadata.openGraph.image || metadata.twitter.image

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Slack Message Unfurl
      </div>

      <div className="rounded-xl border border-[#2b2d31] bg-[#1a1d21] p-4 font-sans text-xs text-[#d1d2d3] shadow-md">
        {/* Slack author header */}
        <div className="mb-2 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded bg-[#e01e5a] text-xs font-bold text-white">
            #
          </div>
          <div>
            <span className="text-xs font-bold text-[#f8f8f8]">bot_agent</span>
            <span className="ms-1.5 text-[10px] text-[#abacad]">
              APP 2:45 PM
            </span>
          </div>
        </div>

        <div className="mb-2 break-all text-[#1d9bd1] underline">
          {metadata.url}
        </div>

        {/* Unfurl Box */}
        <div className="flex max-w-[420px] flex-col gap-1 border-s-[4px] border-[#e01e5a] py-1 ps-3">
          <div className="text-[11px] font-bold text-[#abacad] uppercase">
            {metadata.openGraph.siteName || "IRIS"}
          </div>
          <div className="cursor-pointer text-sm font-bold text-[#1d9bd1] hover:underline">
            {title}
          </div>
          <div className="line-clamp-3 text-xs leading-relaxed text-[#d1d2d3]">
            {description}
          </div>
          {image && (
            <div className="mt-2 max-h-48 max-w-sm overflow-hidden rounded-lg border border-[#2b2d31]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={title}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Facebook & LinkedIn Open Graph Preview                                    */
/* -------------------------------------------------------------------------- */
function FacebookPreview({ metadata }: { metadata: PageMetadataInfo }) {
  const title = metadata.openGraph.title || metadata.title || "IRIS"
  const description =
    metadata.openGraph.description ||
    metadata.description ||
    "No description provided."
  const image = metadata.openGraph.image
  const domain =
    typeof window !== "undefined"
      ? window.location.hostname.toUpperCase()
      : "IRIS.LOCAL"

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Facebook & LinkedIn Preview
      </div>

      <div className="max-w-[440px] overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground shadow-md">
        {/* Cover */}
        {image ? (
          <div className="aspect-[1.91/1] w-full overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[1.91/1] w-full items-center justify-center gap-1.5 bg-muted text-xs text-muted-foreground">
            <IconPhoto className="size-4" /> Missing og:image
          </div>
        )}

        {/* Content Box */}
        <div className="flex flex-col gap-0.5 border-t border-border/40 bg-muted/30 p-3">
          <div className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {domain}
          </div>
          <div className="line-clamp-1 text-sm font-semibold text-foreground">
            {title}
          </div>
          <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Telegram Preview                                                           */
/* -------------------------------------------------------------------------- */
function TelegramPreview({ metadata }: { metadata: PageMetadataInfo }) {
  const title = metadata.openGraph.title || metadata.title || "IRIS"
  const description =
    metadata.openGraph.description ||
    metadata.description ||
    "No description provided."
  const image = metadata.openGraph.image || metadata.twitter.image

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Telegram Preview
      </div>

      <div className="max-w-[420px] rounded-xl border border-[#242f3d] bg-[#182533] p-4 font-sans text-xs text-white shadow-md">
        <div className="mb-2 text-xs break-all text-[#64b5f6] underline">
          {metadata.url}
        </div>

        <div className="flex flex-col gap-1.5 overflow-hidden rounded-xl border-s-[3px] border-[#5bb543] bg-[#242f3d] p-3">
          <div className="text-[11px] font-semibold text-[#5bb543]">
            {metadata.openGraph.siteName || "IRIS"}
          </div>
          <div className="text-sm leading-snug font-bold text-[#e4ecf2]">
            {title}
          </div>
          <div className="line-clamp-3 text-xs leading-relaxed text-[#a0abb5]">
            {description}
          </div>
          {image && (
            <div className="mt-1.5 max-h-48 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={title}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
