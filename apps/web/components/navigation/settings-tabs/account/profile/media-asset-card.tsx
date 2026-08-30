"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import {
  IconUpload,
  IconDownload,
  IconTrash,
  IconPhoto,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { ImageCropperModal } from "./image-cropper-modal";

export interface MediaAssetCardProps {
  title: string;
  description: string;
  assetType: "avatar" | "banner" | "nameplate" | "sidebarBanner" | "avatarFrame";
  currentUrl?: string | null;
  avatarUrl?: string | null;
  onPendingFileChange: (file: File | null, previewUrl: string | null) => void;
  aspectRatio?: "square" | "banner" | "sidebar";
  fallbackInitial?: string;
  disabled?: boolean;
}

function isValidFrameUrl(url?: string | null): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  return (
    trimmed !== "" &&
    trimmed !== "none" &&
    (trimmed.startsWith("/") ||
      trimmed.startsWith("http") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:"))
  );
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
  const t = useTranslations("navigation.settings.account.profile");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileForCrop, setSelectedFileForCrop] = useState<File | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const acceptedFormats =
    assetType === "avatarFrame"
      ? "image/png,image/webp,image/svg+xml"
      : "image/png,image/jpeg,image/webp,image/gif";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size validation (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("fileExceedsLimit"));
      return;
    }

    // Format validation
    const allowed =
      assetType === "avatarFrame"
        ? ["image/png", "image/webp", "image/svg+xml"]
        : ["image/png", "image/jpeg", "image/webp", "image/gif"];

    if (!allowed.includes(file.type)) {
      toast.error(t("invalidFormat", { formats: allowed.map((f) => f.split("/")[1]?.toUpperCase()).join(", ") }));
      return;
    }

    // If SVG, skip canvas crop and create preview directly
    if (file.type === "image/svg+xml") {
      const previewUrl = URL.createObjectURL(file);
      onPendingFileChange(file, previewUrl);
      toast.success(t("assetSelected", { title }));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Open Cropper Modal
    setSelectedFileForCrop(file);
    setCropModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropComplete = (croppedFile: File) => {
    const previewUrl = URL.createObjectURL(croppedFile);
    onPendingFileChange(croppedFile, previewUrl);
    toast.success(t("assetCropped", { title }));
  };

  const handleDownload = () => {
    if (!currentUrl) return;
    const link = document.createElement("a");
    link.href = currentUrl;
    link.download = `${assetType}-${Date.now()}`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t("downloadStarted"));
  };

  const handleRemove = () => {
    onPendingFileChange(null, null);
    toast.info(t("assetRemoved", { title }));
  };

  const isFrameType = assetType === "avatarFrame";
  const hasValidFrame = isValidFrameUrl(currentUrl);

  return (
    <>
      <Card className="rounded-2xl border border-border/60 bg-card/60 shadow-xs overflow-hidden flex flex-col justify-between h-full">
        <CardHeader className="pb-3 min-h-[68px]">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <IconPhoto className="size-4 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 leading-normal">
            {description}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 mt-auto">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats}
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Thumbnail Preview & Actions Area */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 rounded-xl border border-border/50 bg-muted/15 min-h-[76px]">
            {aspectRatio === "square" && (
              <div className="relative shrink-0 flex items-center justify-center size-16">
                {isFrameType ? (
                  /* Frame Preview with User Avatar underneath */
                  <div className="relative size-16 flex items-center justify-center">
                    <div className="relative size-12 rounded-full overflow-hidden border border-border/60 bg-background flex items-center justify-center">
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
                      <div className="absolute inset-0 size-16 pointer-events-none select-none z-10">
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
                      <div className="absolute inset-0 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center" />
                    )}
                  </div>
                ) : (
                  <div className="relative size-16 rounded-full overflow-hidden border border-border/60 bg-background flex items-center justify-center">
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
              <div className="relative w-full sm:w-48 h-16 rounded-xl overflow-hidden border border-border/60 bg-muted/40 shrink-0">
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
                  <div className="size-full flex flex-col items-center justify-center text-muted-foreground/50 text-[10px] gap-1">
                    <IconPhoto className="size-4" />
                    <span>{t("noBannerSet")}</span>
                  </div>
                )}
              </div>
            )}

            {aspectRatio === "sidebar" && (
              <div className="relative w-full sm:w-48 h-16 rounded-xl overflow-hidden border border-border/60 bg-muted/40 shrink-0">
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
                  <div className="size-full flex flex-col items-center justify-center text-muted-foreground/50 text-[10px] gap-1">
                    <IconPhoto className="size-4" />
                    <span>{t("defaultNameplateStyle")}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onPress={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs rounded-xl cursor-pointer"
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
                    className="rounded-xl cursor-pointer text-muted-foreground hover:text-foreground"
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
                    className="rounded-xl cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10"
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
  );
}
