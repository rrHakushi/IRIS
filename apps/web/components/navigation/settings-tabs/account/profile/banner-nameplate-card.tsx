"use client"

import React, { useRef, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import {
  IconUpload,
  IconDownload,
  IconTrash,
  IconPhoto,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { ImageCropperModal } from "./image-cropper-modal"

export interface BannerNameplateCardProps {
  bannerUrl?: string | null
  bannerOverlayUrl?: string | null
  nameplateUrl?: string | null
  onPendingBannerChange: (file: File | null, previewUrl: string | null) => void
  onPendingOverlayChange: (file: File | null, previewUrl: string | null) => void
  onPendingNameplateChange: (file: File | null, previewUrl: string | null) => void
  disabled?: boolean
}

type CropTarget = {
  file: File
  aspectRatio: "banner" | "sidebar"
  title: string
  onComplete: (croppedFile: File) => void
}

export function BannerNameplateCard({
  bannerUrl,
  bannerOverlayUrl,
  nameplateUrl,
  onPendingBannerChange,
  onPendingOverlayChange,
  onPendingNameplateChange,
  disabled = false,
}: BannerNameplateCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")

  const bannerInputRef = useRef<HTMLInputElement>(null)
  const overlayInputRef = useRef<HTMLInputElement>(null)
  const nameplateInputRef = useRef<HTMLInputElement>(null)

  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null)

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "banner" | "bannerOverlay" | "nameplate"
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10MB file limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("fileExceedsLimit"))
      return
    }

    const allowed =
      type === "bannerOverlay"
        ? ["image/png", "image/webp", "image/svg+xml", "image/gif"]
        : ["image/png", "image/jpeg", "image/webp", "image/gif"]

    if (!allowed.includes(file.type)) {
      toast.error(
        t("invalidFormat", {
          formats: allowed
            .map((f) => f.split("/")[1]?.toUpperCase())
            .join(", "),
        })
      )
      return
    }

    const titleMap = {
      banner: t("banner"),
      bannerOverlay: "Banner Overlay",
      nameplate: t("nameplate"),
    }
    const itemTitle = titleMap[type]

    // If SVG, skip cropping
    if (file.type === "image/svg+xml") {
      const previewUrl = URL.createObjectURL(file)
      if (type === "banner") onPendingBannerChange(file, previewUrl)
      else if (type === "bannerOverlay") onPendingOverlayChange(file, previewUrl)
      else onPendingNameplateChange(file, previewUrl)

      toast.success(t("assetSelected", { title: itemTitle }))
      e.target.value = ""
      return
    }

    // Prepare crop modal
    setCropTarget({
      file,
      aspectRatio: type === "nameplate" ? "sidebar" : "banner",
      title: itemTitle,
      onComplete: (croppedFile) => {
        const previewUrl = URL.createObjectURL(croppedFile)
        if (type === "banner") onPendingBannerChange(croppedFile, previewUrl)
        else if (type === "bannerOverlay")
          onPendingOverlayChange(croppedFile, previewUrl)
        else onPendingNameplateChange(croppedFile, previewUrl)

        toast.success(t("assetCropped", { title: itemTitle }))
      },
    })

    e.target.value = ""
  }

  const handleDownload = (url: string | null | undefined, title: string) => {
    if (!url) return
    const link = document.createElement("a")
    link.href = url
    link.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t("downloadStarted"))
  }

  const items = [
    {
      id: "banner" as const,
      title: t("banner"),
      url: bannerUrl,
      inputRef: bannerInputRef,
      accept: "image/png,image/jpeg,image/webp,image/gif",
      onRemove: () => {
        onPendingBannerChange(null, null)
        toast.info(t("assetRemoved", { title: t("banner") }))
      },
    },
    {
      id: "bannerOverlay" as const,
      title: "Banner Overlay",
      url: bannerOverlayUrl,
      inputRef: overlayInputRef,
      accept: "image/png,image/webp,image/svg+xml,image/gif",
      onRemove: () => {
        onPendingOverlayChange(null, null)
        toast.info(t("assetRemoved", { title: "Banner Overlay" }))
      },
    },
    {
      id: "nameplate" as const,
      title: t("nameplate"),
      url: nameplateUrl,
      inputRef: nameplateInputRef,
      accept: "image/png,image/jpeg,image/webp,image/gif",
      onRemove: () => {
        onPendingNameplateChange(null, null)
        toast.info(t("assetRemoved", { title: t("nameplate") }))
      },
    },
  ]

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <IconPhoto className="size-4 text-primary" />
            <span>Banners & Nameplate</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-1.5">
                {/* Hidden file input */}
                <input
                  ref={item.inputRef}
                  type="file"
                  accept={item.accept}
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, item.id)}
                />

                {/* Title */}
                <span className="text-xs font-semibold text-foreground truncate">
                  {item.title}
                </span>

                {/* Preview / Upload Box */}
                <div className="group relative h-24 w-full overflow-hidden rounded-xl border border-border/60 bg-muted/20 transition-all">
                  {item.url ? (
                    <>
                      {/* Uploaded Image Preview */}
                      <Image
                        src={item.url}
                        alt={item.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        unoptimized
                        className="object-cover"
                      />

                      {/* On Hover Action Buttons Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 backdrop-blur-xs transition-opacity duration-150 group-hover:opacity-100">
                        {/* Change Image */}
                        <span title="Change Image">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => item.inputRef.current?.click()}
                            aria-label="Change Image"
                            className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-foreground shadow-sm transition-transform hover:scale-110 hover:bg-background cursor-pointer"
                          >
                            <IconUpload className="size-3.5" />
                          </button>
                        </span>

                        {/* Download Image */}
                        <span title="Download Image">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => handleDownload(item.url, item.title)}
                            aria-label="Download Image"
                            className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-foreground shadow-sm transition-transform hover:scale-110 hover:bg-background cursor-pointer"
                          >
                            <IconDownload className="size-3.5" />
                          </button>
                        </span>

                        {/* Remove Image */}
                        <span title="Remove Image">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={item.onRemove}
                            aria-label="Remove Image"
                            className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-destructive shadow-sm transition-transform hover:scale-110 hover:bg-destructive/15 cursor-pointer"
                          >
                            <IconTrash className="size-3.5" />
                          </button>
                        </span>
                      </div>
                    </>
                  ) : (
                    /* Empty State: Upload Image */
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => item.inputRef.current?.click()}
                      className="flex size-full flex-col items-center justify-center gap-1.5 border border-dashed border-border/70 p-2 text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/40 hover:text-foreground cursor-pointer"
                    >
                      <IconUpload className="size-4 text-muted-foreground" />
                      <span className="text-[11px] font-medium">Upload Image</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shared Cropper Modal */}
      {cropTarget && (
        <ImageCropperModal
          open={Boolean(cropTarget)}
          onOpenChange={(open) => {
            if (!open) setCropTarget(null)
          }}
          imageFile={cropTarget.file}
          aspectRatio={cropTarget.aspectRatio}
          title={t("cropTitle", { title: cropTarget.title })}
          onCropComplete={(croppedFile) => {
            cropTarget.onComplete(croppedFile)
            setCropTarget(null)
          }}
        />
      )}
    </>
  )
}
