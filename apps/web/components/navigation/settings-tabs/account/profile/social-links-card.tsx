"use client"

import React, { useState } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  IconLink,
  IconPlus,
  IconTrash,
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

export function getDomainFromUrl(urlStr: string): string {
  try {
    const formatted =
      urlStr.startsWith("http://") || urlStr.startsWith("https://")
        ? urlStr
        : `https://${urlStr}`
    const parsed = new URL(formatted)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return urlStr.replace(/^https?:\/\//, "").split("/")[0] || urlStr
  }
}

export function getFaviconUrl(urlStr: string): string {
  const domain = getDomainFromUrl(urlStr)
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
}

export function SocialFaviconIcon({
  url,
  alt = "icon",
  className = "size-3.5",
}: {
  url: string
  alt?: string
  className?: string
}): React.JSX.Element {
  const [error, setError] = useState(false)
  const favicon = getFaviconUrl(url)

  if (error || !url) {
    return <IconWorld className={cn(className, "text-muted-foreground")} />
  }

  return (
    <img
      src={favicon}
      alt={alt}
      className={cn(className, "rounded-xs object-contain")}
      onError={() => setError(true)}
      loading="lazy"
    />
  )
}

export function SocialLinksCard({
  socialLinks,
  onChange,
  disabled = false,
}: SocialLinksCardProps): React.JSX.Element {
  const [urlInput, setUrlInput] = useState("")
  const [labelInput, setLabelInput] = useState("")

  const handleAddLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmedUrl = urlInput.trim()
    if (!trimmedUrl) return

    const domain = getDomainFromUrl(trimmedUrl)
    const formattedUrl =
      trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")
        ? trimmedUrl
        : `https://${trimmedUrl}`

    const newLink: SocialLink = {
      platform: domain || "link",
      url: formattedUrl,
      label: labelInput.trim() || domain,
    }

    onChange([...socialLinks, newLink])
    setUrlInput("")
    setLabelInput("")
  }

  const handleRemoveLink = (index: number) => {
    const updated = socialLinks.filter((_, i) => i !== index)
    onChange(updated)
  }

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
                <SocialFaviconIcon url={link.url} className="size-3.5" />
                <span className="max-w-[160px] truncate">
                  {link.label || getDomainFromUrl(link.url)}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  title="Open link"
                >
                  <IconExternalLink className="size-3" />
                </a>
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
            No links added yet. Enter a website, social profile, or portfolio URL below.
          </div>
        )}

        {/* Add link form: URL + Label only */}
        <div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase">
              Add Link
            </div>
            {urlInput.trim() && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <SocialFaviconIcon url={urlInput} className="size-3" />
                <span className="font-mono">{getDomainFromUrl(urlInput)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <div className="sm:col-span-7">
              <Input
                placeholder="https://... or domain.com/profile"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={disabled}
                className="h-8 text-xs"
              />
            </div>
            <div className="sm:col-span-5 flex gap-2">
              <Input
                placeholder={
                  urlInput.trim()
                    ? `Label (e.g. ${getDomainFromUrl(urlInput)})`
                    : "Label (optional)"
                }
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
