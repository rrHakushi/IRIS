"use client"

import React, { useMemo, useState } from "react"
import { IconX } from "@tabler/icons-react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"

interface ImagesTabProps {
  coverImage: string | null
  bannerImage: string | null
  images: Record<string, string[] | string | null> | null
}

type ImageCategoryKey =
  "all" | "posters" | "backgrounds" | "banners" | "screencaps"

function classifyImageUrl(
  url: string,
  context?: "cover" | "banner"
): Exclude<ImageCategoryKey, "all"> {
  if (context === "cover") return "posters"
  if (context === "banner") return "banners"

  const lower = url.toLowerCase()
  if (
    lower.includes("/posters/") ||
    lower.includes("/poster") ||
    lower.includes("/cover/") ||
    lower.includes("cover") ||
    lower.includes("cdn.myanimelist.net/images/anime")
  ) {
    return "posters"
  }
  if (
    lower.includes("/backgrounds/") ||
    lower.includes("/background/") ||
    lower.includes("background") ||
    lower.includes("fanart") ||
    lower.includes("wallpaper")
  ) {
    return "backgrounds"
  }
  if (
    lower.includes("/banners/") ||
    lower.includes("/banner/") ||
    lower.includes("banner")
  ) {
    return "banners"
  }
  if (
    lower.includes("/screencap") ||
    lower.includes("screenshot") ||
    lower.includes("/still/") ||
    lower.includes("episode")
  ) {
    return "screencaps"
  }
  return "posters"
}

export function ImagesTab({ coverImage, bannerImage, images }: ImagesTabProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<ImageCategoryKey>("all")

  // Categorize and deduplicate images
  const categorizedImages = useMemo(() => {
    const rawAll: Array<{
      url: string
      category: Exclude<ImageCategoryKey, "all">
    }> = []
    const seen = new Set<string>()

    const add = (url?: string | null, context?: "cover" | "banner") => {
      if (!url || typeof url !== "string") return

      // Deduplicate lower resolution variants
      if (url.includes("/cover/medium/") || url.includes("/cover/small/"))
        return
      if (url.endsWith(".jpg") && !url.endsWith("l.jpg")) {
        const higherRes = url.slice(0, -4) + "l.jpg"
        if (seen.has(higherRes)) return
      }

      if (seen.has(url)) return
      seen.add(url)

      const category = classifyImageUrl(url, context)
      rawAll.push({ url, category })
    }

    // Add cover and banner first
    add(coverImage, "cover")
    add(bannerImage, "banner")

    // Add provider galleries
    if (images && typeof images === "object") {
      for (const [providerKey, urls] of Object.entries(images)) {
        if (Array.isArray(urls)) {
          for (const u of urls) {
            let context: "cover" | "banner" | undefined
            const lowerKey = providerKey.toLowerCase()
            if (lowerKey.includes("banner")) context = "banner"
            if (lowerKey.includes("cover") || lowerKey.includes("poster"))
              context = "cover"
            add(u, context)
          }
        } else if (typeof urls === "string") {
          let context: "cover" | "banner" | undefined
          const lowerKey = providerKey.toLowerCase()
          if (lowerKey.includes("banner")) context = "banner"
          if (lowerKey.includes("cover") || lowerKey.includes("poster"))
            context = "cover"
          add(urls, context)
        }
      }
    }

    const posters = rawAll
      .filter((i) => i.category === "posters")
      .map((i) => i.url)
    const backgrounds = rawAll
      .filter((i) => i.category === "backgrounds")
      .map((i) => i.url)
    const banners = rawAll
      .filter((i) => i.category === "banners")
      .map((i) => i.url)
    const screencaps = rawAll
      .filter((i) => i.category === "screencaps")
      .map((i) => i.url)
    const all = rawAll.map((i) => i.url)

    return {
      all,
      posters,
      backgrounds,
      banners,
      screencaps,
    }
  }, [coverImage, bannerImage, images])

  // Build category tabs - ONLY SHOW IF AVAILABLE
  const availableCategories = useMemo(() => {
    const tabs: Array<{ key: ImageCategoryKey; label: string; count: number }> =
      [{ key: "all", label: "All", count: categorizedImages.all.length }]

    if (categorizedImages.posters.length > 0) {
      tabs.push({
        key: "posters",
        label: "Posters & Covers",
        count: categorizedImages.posters.length,
      })
    }
    if (categorizedImages.backgrounds.length > 0) {
      tabs.push({
        key: "backgrounds",
        label: "Backgrounds",
        count: categorizedImages.backgrounds.length,
      })
    }
    if (categorizedImages.banners.length > 0) {
      tabs.push({
        key: "banners",
        label: "Banners",
        count: categorizedImages.banners.length,
      })
    }
    if (categorizedImages.screencaps.length > 0) {
      tabs.push({
        key: "screencaps",
        label: "Screencaps",
        count: categorizedImages.screencaps.length,
      })
    }

    return tabs
  }, [categorizedImages])

  // Current list based on active category
  const displayedImages =
    categorizedImages[activeCategory] || categorizedImages.all

  if (categorizedImages.all.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No images available for this title.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Category Filter Pills: Only shown if multiple categories available */}
      {availableCategories.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {availableCategories.map((cat) => {
            const isActive = activeCategory === cat.key
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors outline-none select-none ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {cat.label}
                <span className="ms-1.5 text-[10px] tabular-nums opacity-70">
                  ({cat.count})
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Grid: All artwork as is, no cutting, only downscaling */}
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {displayedImages.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSelectedImage(url)}
            className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-1 text-start transition-colors outline-none hover:border-border/80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={url}
              alt={`Artwork ${idx + 1}`}
              loading="lazy"
              className="block h-auto w-full rounded-xl object-contain"
            />
          </button>
        ))}
      </div>

      {/* Full Image Popup Modal */}
      {selectedImage && (
        <Dialog
          isOpen={Boolean(selectedImage)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setSelectedImage(null)
          }}
          className="gap-3 p-3 sm:max-w-5xl"
        >
          <DialogHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-2">
            <DialogTitle className="text-sm font-semibold">
              Artwork Preview
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg"
              onClick={() => setSelectedImage(null)}
              aria-label="Close image preview"
            >
              <IconX className="size-4" aria-hidden="true" />
            </Button>
          </DialogHeader>

          <div className="relative flex max-h-[82vh] w-full items-center justify-center overflow-auto rounded-xl bg-black/40 p-2">
            <img
              src={selectedImage}
              alt="Artwork preview"
              className="max-h-[78vh] w-auto max-w-full rounded-lg object-contain"
            />
          </div>
        </Dialog>
      )}
    </div>
  )
}
