"use client"

import React, { memo, useState, useEffect, useMemo } from "react"
import type { SearchResult } from "./types"
import { KiroshiImageLightbox } from "./kiroshi-image-lightbox"
import { cn } from "@workspace/ui/lib/utils"
import { trackKiroshiClick } from "@/lib/kiroshi-tracking"

export interface KiroshiImagesGridProps {
  results: SearchResult[]
  query?: string
  className?: string
}

function useColumnCount(): number {
  const [columns, setColumns] = useState(4)

  useEffect(() => {
    function calculateColumns() {
      const w = window.innerWidth
      if (w < 640) return 2
      if (w < 768) return 3
      if (w < 1024) return 4
      if (w < 1280) return 5
      if (w < 1536) return 6
      return 7
    }

    setColumns(calculateColumns())

    const handleResize = () => {
      setColumns(calculateColumns())
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return columns
}

function parseAspectRatio(resolution?: string | null): number | undefined {
  if (!resolution) return undefined
  const match = resolution.match(/(\d+)\s*[x×]\s*(\d+)/i)
  if (match && match[1] && match[2]) {
    const w = parseInt(match[1], 10)
    const h = parseInt(match[2], 10)
    if (w > 0 && h > 0) {
      return w / h
    }
  }
  return undefined
}

export const KiroshiImagesGrid = memo(function KiroshiImagesGrid({
  results,
  query,
  className,
}: KiroshiImagesGridProps): React.JSX.Element {
  const [selectedImage, setSelectedImage] = useState<SearchResult | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const columnCount = useColumnCount()

  const handleOpenLightbox = (item: SearchResult) => {
    trackKiroshiClick({
      url: item.url,
      title: item.title,
      category: "images",
      thumbnail: item.img_src || item.thumbnail || undefined,
      query,
    })
    setSelectedImage(item)
    setLightboxOpen(true)
  }

  // Filter results that have valid image URLs
  const validImages = useMemo(
    () => results.filter((res) => Boolean(res.img_src || res.thumbnail)),
    [results]
  )

  // Distribute items deterministically into fixed column stacks to prevent layout shift on infinite scroll
  const columns = useMemo(() => {
    const cols: SearchResult[][] = Array.from({ length: columnCount }, () => [])
    validImages.forEach((img, idx) => {
      const targetCol = cols[idx % columnCount]
      if (targetCol) {
        targetCol.push(img)
      }
    })
    return cols
  }, [validImages, columnCount])

  return (
    <>
      <div
        className={cn(
          "flex gap-3.5 w-full items-start",
          className
        )}
      >
        {columns.map((columnImages, colIndex) => (
          <div
            key={colIndex}
            className="flex-1 flex flex-col gap-3.5 min-w-0"
          >
            {columnImages.map((res, itemIndex) => {
              const imgUrl = res.img_src || res.thumbnail || ""
              const ratio = parseAspectRatio(res.resolution)

              return (
                <button
                  key={`${res.url}-${itemIndex}`}
                  type="button"
                  onClick={() => handleOpenLightbox(res)}
                  className="group relative block w-full overflow-hidden rounded-xl border border-border/40 bg-card text-start transition-all duration-200 hover:border-primary/50 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer shrink-0"
                >
                  <div
                    className="relative w-full bg-muted/30 overflow-hidden"
                    style={ratio ? { aspectRatio: String(ratio) } : undefined}
                  >
                    <img
                      src={imgUrl}
                      alt={res.title}
                      className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                      onError={(e) => {
                        const parentBtn = e.currentTarget.closest("button")
                        if (parentBtn) parentBtn.style.display = "none"
                      }}
                    />
                  </div>

                  {/* Hover overlay hint */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex items-end p-2.5 pointer-events-none">
                    <span className="text-[11px] text-white font-medium line-clamp-1 drop-shadow-xs">
                      {res.title}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <KiroshiImageLightbox
        item={selectedImage}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  )
})
