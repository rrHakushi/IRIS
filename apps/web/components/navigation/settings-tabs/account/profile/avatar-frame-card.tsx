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
  IconUser,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { ImageCropperModal } from "./image-cropper-modal"

export interface AvatarFrameCardProps {
  avatarUrl?: string | null
  avatarFrame?: string | null
  fallbackInitial?: string
  onPendingAvatarChange: (file: File | null, previewUrl: string | null) => void
  onPendingFrameChange: (file: File | null, previewUrl: string | null) => void
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

export function AvatarFrameCard({
  avatarUrl,
  avatarFrame,
  fallbackInitial = "U",
  onPendingAvatarChange,
  onPendingFrameChange,
  disabled = false,
}: AvatarFrameCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const frameInputRef = useRef<HTMLInputElement>(null)

  const [cropTarget, setCropTarget] = useState<{
    file: File
    title: string
    onComplete: (croppedFile: File) => void
  } | null>(null)

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "avatar" | "avatarFrame"
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("fileExceedsLimit"))
      return
    }

    const allowed =
      type === "avatarFrame"
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

    const itemTitle =
      type === "avatar" ? t("profilePicture") : t("avatarFrame")

    // If SVG, skip cropping
    if (file.type === "image/svg+xml") {
      const previewUrl = URL.createObjectURL(file)
      if (type === "avatar") onPendingAvatarChange(file, previewUrl)
      else onPendingFrameChange(file, previewUrl)

      toast.success(t("assetSelected", { title: itemTitle }))
      e.target.value = ""
      return
    }

    // Prepare crop modal
    setCropTarget({
      file,
      title: itemTitle,
      onComplete: (croppedFile) => {
        const previewUrl = URL.createObjectURL(croppedFile)
        if (type === "avatar") onPendingAvatarChange(croppedFile, previewUrl)
        else onPendingFrameChange(croppedFile, previewUrl)

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

  const hasValidFrame = isValidFrameUrl(avatarFrame)

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <IconUser className="size-4 text-primary" />
            <span>Profile Picture & Frame</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* 1. Profile Picture (Avatar) */}
            <div className="flex flex-col gap-1.5">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "avatar")}
              />

              <span className="text-xs font-semibold text-foreground truncate">
                {t("profilePicture")}
              </span>

              <div className="group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20 transition-all">
                {avatarUrl ? (
                  <>
                    {/* Circular Avatar */}
                    <div className="relative size-16 overflow-hidden rounded-full border border-border/60 bg-background shadow-xs">
                      <Image
                        src={avatarUrl}
                        alt="Profile Picture"
                        fill
                        sizes="64px"
                        unoptimized
                        className="object-cover"
                      />
                    </div>

                    {/* On Hover Action Buttons Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 backdrop-blur-xs transition-opacity duration-150 group-hover:opacity-100">
                      <span title="Change Image">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => avatarInputRef.current?.click()}
                          aria-label="Change Image"
                          className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-foreground shadow-sm transition-transform hover:scale-110 hover:bg-background cursor-pointer"
                        >
                          <IconUpload className="size-3.5" />
                        </button>
                      </span>

                      <span title="Download Image">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            handleDownload(avatarUrl, t("profilePicture"))
                          }
                          aria-label="Download Image"
                          className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-foreground shadow-sm transition-transform hover:scale-110 hover:bg-background cursor-pointer"
                        >
                          <IconDownload className="size-3.5" />
                        </button>
                      </span>

                      <span title="Remove Image">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            onPendingAvatarChange(null, null)
                            toast.info(
                              t("assetRemoved", { title: t("profilePicture") })
                            )
                          }}
                          aria-label="Remove Image"
                          className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-destructive shadow-sm transition-transform hover:scale-110 hover:bg-destructive/15 cursor-pointer"
                        >
                          <IconTrash className="size-3.5" />
                        </button>
                      </span>
                    </div>
                  </>
                ) : (
                  /* Empty state */
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex size-full flex-col items-center justify-center gap-1.5 border border-dashed border-border/70 p-2 text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/40 hover:text-foreground cursor-pointer"
                  >
                    <IconUpload className="size-4 text-muted-foreground" />
                    <span className="text-[11px] font-medium">Upload Image</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. Avatar Frame */}
            <div className="flex flex-col gap-1.5">
              <input
                ref={frameInputRef}
                type="file"
                accept="image/png,image/webp,image/svg+xml,image/gif"
                className="hidden"
                onChange={(e) => handleFileSelect(e, "avatarFrame")}
              />

              <span className="text-xs font-semibold text-foreground truncate">
                {t("avatarFrame")}
              </span>

              <div className="group relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/20 transition-all">
                {hasValidFrame ? (
                  <>
                    {/* Avatar with Frame Preview */}
                    <div className="relative flex size-18 items-center justify-center">
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
                      <div className="pointer-events-none absolute inset-0 z-10 size-18 select-none">
                        <Image
                          src={avatarFrame!}
                          alt="Avatar Frame"
                          fill
                          sizes="72px"
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    </div>

                    {/* On Hover Action Buttons Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/60 opacity-0 backdrop-blur-xs transition-opacity duration-150 group-hover:opacity-100">
                      <span title="Change Frame">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => frameInputRef.current?.click()}
                          aria-label="Change Frame"
                          className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-foreground shadow-sm transition-transform hover:scale-110 hover:bg-background cursor-pointer"
                        >
                          <IconUpload className="size-3.5" />
                        </button>
                      </span>

                      <span title="Download Frame">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            handleDownload(avatarFrame, t("avatarFrame"))
                          }
                          aria-label="Download Frame"
                          className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-foreground shadow-sm transition-transform hover:scale-110 hover:bg-background cursor-pointer"
                        >
                          <IconDownload className="size-3.5" />
                        </button>
                      </span>

                      <span title="Remove Frame">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            onPendingFrameChange(null, null)
                            toast.info(
                              t("assetRemoved", { title: t("avatarFrame") })
                            )
                          }}
                          aria-label="Remove Frame"
                          className="flex size-7.5 items-center justify-center rounded-lg bg-background/90 text-destructive shadow-sm transition-transform hover:scale-110 hover:bg-destructive/15 cursor-pointer"
                        >
                          <IconTrash className="size-3.5" />
                        </button>
                      </span>
                    </div>
                  </>
                ) : (
                  /* Empty state */
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => frameInputRef.current?.click()}
                    className="flex size-full flex-col items-center justify-center gap-1.5 border border-dashed border-border/70 p-2 text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted/40 hover:text-foreground cursor-pointer"
                  >
                    <IconUpload className="size-4 text-muted-foreground" />
                    <span className="text-[11px] font-medium">Upload Frame</span>
                  </button>
                )}
              </div>
            </div>
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
          aspectRatio="square"
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
