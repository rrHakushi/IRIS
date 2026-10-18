"use client"

import React, { memo, useState } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconPhoto,
  IconWorld,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { trackKiroshiClick } from "@/lib/kiroshi-tracking"
import type { SearchResult } from "./types"

export interface KiroshiImageLightboxProps {
  item: SearchResult | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const KiroshiImageLightbox = memo(function KiroshiImageLightbox({
  item,
  open,
  onOpenChange,
}: KiroshiImageLightboxProps): React.JSX.Element | null {
  const [copied, setCopied] = useState(false)
  const [imageError, setImageError] = useState(false)

  if (!item) return null

  const imageUrl = item.img_src || item.thumbnail || ""
  let domain = ""
  try {
    domain = new URL(item.url).hostname.replace(/^www\./, "")
  } catch {
    domain = item.url
  }

  const handleCopyLink = () => {
    if (!imageUrl) return
    navigator.clipboard.writeText(imageUrl)
    setCopied(true)
    toast.success("Image URL copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="max-w-3xl overflow-hidden p-0 gap-0 border-border/70 bg-card/95 backdrop-blur-xl sm:max-w-3xl"
    >
      <div className="relative flex max-h-[65vh] w-full items-center justify-center bg-black/40 overflow-hidden">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={item.title}
            onError={() => setImageError(true)}
            className="max-h-[65vh] w-auto max-w-full object-contain transition-all"
          />
        ) : (
          <div className="flex h-64 w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <IconPhoto className="size-12 opacity-40" />
            <span className="text-xs">Image unavailable</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        <DialogHeader className="space-y-1 text-start">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconWorld className="size-3.5 shrink-0" />
            <span className="font-mono">{domain}</span>
            {item.resolution && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {item.resolution}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-base sm:text-lg font-semibold leading-snug">
            {item.title}
          </DialogTitle>
          {item.content && (
            <DialogDescription className="text-xs text-muted-foreground line-clamp-2">
              {item.content}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 text-xs"
          >
            {copied ? (
              <IconCheck className="size-3.5 text-emerald-500" />
            ) : (
              <IconCopy className="size-3.5" />
            )}
            <span>Copy Image Link</span>
          </Button>

          <div className="flex items-center gap-2">
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackKiroshiClick({
                    url: imageUrl,
                    title: item.title,
                    category: "images",
                    thumbnail: imageUrl,
                  })
                }
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: "gap-1.5 text-xs text-muted-foreground hover:text-foreground",
                })}
              >
                <span>Direct Image</span>
                <IconExternalLink className="size-3" />
              </a>
            )}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackKiroshiClick({
                  url: item.url,
                  title: item.title,
                  category: "images",
                  thumbnail: imageUrl,
                })
              }
              className={buttonVariants({
                variant: "default",
                size: "sm",
                className: "gap-1.5 text-xs",
              })}
            >
              <span>Visit Website</span>
              <IconExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </Dialog>
  )
})
