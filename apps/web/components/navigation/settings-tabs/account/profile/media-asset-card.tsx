"use client"

import React, { useRef, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import {
  IconUpload,
  IconDownload,
  IconTrash,
  IconPhoto,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { ImageCropperModal } from "./image-cropper-modal"

export interface MediaAssetCardProps {
  title: string
  description: string
  assetType: "avatar" | "banner" | "nameplate" | "sidebarBanner" | "avatarFrame"
  currentUrl?: string | null
  avatarUrl?: string | null
  onPendingFileChange: (file: File | null, previewUrl: string | null) => void
  aspectRatio?: "square" | "banner" | "sidebar"
  fallbackInitial?: string
  disabled?: boolean
}

function isValidFrameUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false
  const trimmed = url.trim()
  return (
    trimmed !== "" &&
    trimmed !== "none" &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("http") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:"))
  )
}

export function MediaAssetCard({
  title,
  description,
  assetType,
  currentUrl,
  avatarUrl,
  onPendingFileChange,
  aspectRatio = "square",
  fallbackInitial = "I",
  disabled = false,
}: MediaAssetCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileForCrop, setSelectedFileForCrop] = useState<File | null>(
    null
  )
  const [cropModalOpen, setCropModalOpen] = useState(false)

  const acceptedFormats =
    assetType === "avatarFrame"
      ? "image/png,image/webp,image/svg+xml"
      : "image/png,image/jpeg,image/webp,image/gif"

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side file size validation (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("fileExceedsLimit"))
      return
    }

    // Format validation
    const allowed =
      assetType === "avatarFrame"
        ? ["image/png", "image/webp", "image/svg+xml"]
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

    // If SVG, skip canvas crop and create preview directly
    if (file.type === "image/svg+xml") {
      const previewUrl = URL.createObjectURL(file)
      onPendingFileChange(file, previewUrl)
      toast.success(t("assetSelected", { title }))
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    // Open Cropper Modal
    setSelectedFileForCrop(file)
    setCropModalOpen(true)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleCropComplete = (croppedFile: File) => {
    const previewUrl = URL.createObjectURL(croppedFile)
    onPendingFileChange(croppedFile, previewUrl)
    toast.success(t("assetCropped", { title }))
  }

  const handleDownload = () => {
    if (!currentUrl) return
    const link = document.createElement("a")
    link.href = currentUrl
    link.download = `${assetType}-${Date.now()}`
    link.target = "_blank"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(t("downloadStarted"))
  }

  const handleRemove = () => {
    onPendingFileChange(null, null)
    toast.info(t("assetRemoved", { title }))
  }

  const isFrameType = assetType === "avatarFrame"
  const hasValidFrame = isValidFrameUrl(currentUrl)

  return (
    <>
      <Card className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xs">
        <CardHeader className="min-h-[68px] pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <IconPhoto className="size-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="mt-0.5 text-xs leading-normal text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-auto pt-0">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats}
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Thumbnail Preview & Actions Area */}
          <div className="flex min-h-[76px] flex-col items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/15 p-3 sm:flex-row sm:items-center">
            {aspectRatio === "square" && (
              <div className="relative flex size-16 shrink-0 items-center justify-center">
                {isFrameType ? (
                  /* Frame Preview with User Avatar underneath */
                  <div className="relative flex size-16 items-center justify-center">
                    <div className="relative flex size-12 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt="Avatar"
                          fill
                          sizes="48px"
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-primary/80 uppercase select-none">
                          {fallbackInitial}
                        </span>
                      )}
                    </div>
                    {hasValidFrame ? (
                      <div className="pointer-events-none absolute inset-0 z-10 size-16 select-none">
                        <Image
                          src={currentUrl}
                          alt="Avatar Frame"
                          fill
                          sizes="64px"
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30" />
                    )}
                  </div>
                ) : (
                  <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background">
                    {currentUrl ? (
                      <Image
                        src={currentUrl}
                        alt={title}
                        fill
                        sizes="64px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-xl font-bold text-primary/80 uppercase">
                        {fallbackInitial}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {aspectRatio === "banner" && (
              <div className="relative h-16 w-full shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/40 sm:w-48">
                {currentUrl ? (
                  <Image
                    src={currentUrl}
                    alt={title}
                    fill
                    sizes="192px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground/50">
                    <IconPhoto className="size-4" />
                    <span>{t("noBannerSet")}</span>
                  </div>
                )}
              </div>
            )}

            {aspectRatio === "sidebar" && (
              <div className="relative h-16 w-full shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/40 sm:w-48">
                {currentUrl ? (
                  <Image
                    src={currentUrl}
                    alt={title}
                    fill
                    sizes="192px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground/50">
                    <IconPhoto className="size-4" />
                    <span>{t("defaultNameplateStyle")}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onPress={() => fileInputRef.current?.click()}
                className="cursor-pointer gap-1.5 rounded-xl text-xs"
              >
                <IconUpload data-icon="inline-start" className="size-3.5" />
                <span>{isFrameType ? t("chooseFrame") : t("chooseImage")}</span>
              </Button>

              {currentUrl && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    onPress={handleDownload}
                    aria-label={t("downloadImageAria")}
                    className="cursor-pointer rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <IconDownload className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    onPress={handleRemove}
                    aria-label={t("removeAssetAria")}
                    className="cursor-pointer rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    <IconTrash className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Crop Modal */}
      {cropModalOpen && selectedFileForCrop && (
        <ImageCropperModal
          open={cropModalOpen}
          onOpenChange={setCropModalOpen}
          imageFile={selectedFileForCrop}
          aspectRatio={aspectRatio}
          title={t("cropTitle", { title })}
          onCropComplete={handleCropComplete}
        />
      )}
    </>
  )
}
