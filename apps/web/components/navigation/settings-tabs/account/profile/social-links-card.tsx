"use client"

import React, { useState } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconLink,
  IconPlus,
  IconTrash,
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandTwitter,
  IconBrandX,
  IconBrandTwitch,
  IconBrandYoutube,
  IconBrandSteam,
  IconWorld,
  IconExternalLink,
} from "@tabler/icons-react"
import type { SocialLink } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"

export interface SocialLinksCardProps {
  socialLinks: SocialLink[]
  onChange: (links: SocialLink[]) => void
  disabled?: boolean
}

const PLATFORMS = [
  { id: "discord", name: "Discord", icon: IconBrandDiscord, placeholder: "discord.gg/... or username" },
  { id: "github", name: "GitHub", icon: IconBrandGithub, placeholder: "https://github.com/..." },
  { id: "x", name: "X / Twitter", icon: IconBrandX, placeholder: "https://x.com/..." },
  { id: "twitch", name: "Twitch", icon: IconBrandTwitch, placeholder: "https://twitch.tv/..." },
  { id: "youtube", name: "YouTube", icon: IconBrandYoutube, placeholder: "https://youtube.com/@..." },
  { id: "steam", name: "Steam", icon: IconBrandSteam, placeholder: "https://steamcommunity.com/id/..." },
  { id: "website", name: "Website", icon: IconWorld, placeholder: "https://..." },
]

export function renderSocialIcon(platform: string, className = "size-4") {
  const norm = platform.toLowerCase()
  if (norm === "discord") return <IconBrandDiscord className={className} />
  if (norm === "github") return <IconBrandGithub className={className} />
  if (norm === "twitter" || norm === "x") return <IconBrandX className={className} />
  if (norm === "twitch") return <IconBrandTwitch className={className} />
  if (norm === "youtube") return <IconBrandYoutube className={className} />
  if (norm === "steam") return <IconBrandSteam className={className} />
  return <IconWorld className={className} />
}

export function SocialLinksCard({
  socialLinks,
  onChange,
  disabled = false,
}: SocialLinksCardProps): React.JSX.Element {
  const [selectedPlatform, setSelectedPlatform] = useState<string>("discord")
  const [urlInput, setUrlInput] = useState("")
  const [labelInput, setLabelInput] = useState("")

  const handleAddLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmedUrl = urlInput.trim()
    if (!trimmedUrl) return

    const newLink: SocialLink = {
      platform: selectedPlatform,
      url: trimmedUrl.startsWith("http") || selectedPlatform === "discord" ? trimmedUrl : `https://${trimmedUrl}`,
      label: labelInput.trim() || undefined,
    }

    onChange([...socialLinks, newLink])
    setUrlInput("")
    setLabelInput("")
  }

  const handleRemoveLink = (index: number) => {
    const updated = socialLinks.filter((_, i) => i !== index)
    onChange(updated)
  }

  const activePlatformConfig = PLATFORMS.find((p) => p.id === selectedPlatform) || PLATFORMS[0]

  return (
    <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <IconLink className="size-4 text-primary" />
          Social & External Links
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Existing links list */}
        {socialLinks.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {socialLinks.map((link, idx) => (
              <div
                key={idx}
                className="group flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-border hover:bg-muted/70"
              >
                <div className="text-primary">{renderSocialIcon(link.platform, "size-3.5")}</div>
                <span className="max-w-[160px] truncate">{link.label || link.url}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => handleRemoveLink(idx)}
                  className="cursor-pointer text-muted-foreground opacity-60 transition-opacity hover:text-destructive hover:opacity-100 disabled:pointer-events-none"
                  title="Remove link"
                >
                  <IconTrash className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground/70">
            No social links added yet. Add one below to display on your profile header!
          </div>
        )}

        {/* Add link form */}
        <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase">
            Add New Link
          </div>

          {/* Platform selector chips */}
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((plat) => {
              const Icon = plat.icon
              const isSelected = selectedPlatform === plat.id
              return (
                <button
                  key={plat.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedPlatform(plat.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50",
                    isSelected
                      ? "border border-primary bg-primary/15 font-semibold text-primary shadow-2xs"
                      : "border border-border/50 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{plat.name}</span>
                </button>
              )
            })}
          </div>

          {/* URL & Optional Label inputs */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <div className="sm:col-span-7">
              <Input
                placeholder={activePlatformConfig?.placeholder || "https://..."}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={disabled}
                className="h-8 text-xs"
              />
            </div>
            <div className="sm:col-span-5 flex gap-2">
              <Input
                placeholder="Label (optional)"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                disabled={disabled}
                className="h-8 text-xs flex-1"
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={disabled || !urlInput.trim()}
                onClick={() => handleAddLink()}
                className="h-8 shrink-0 cursor-pointer gap-1 rounded-xl px-3 text-xs font-semibold"
              >
                <IconPlus className="size-3.5" />
                <span>Add</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
