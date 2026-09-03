"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconRotate,
  IconRotateClockwise,
  IconFlipHorizontal,
  IconFlipVertical,
  IconPhoto,
  IconRotate2,
} from "@tabler/icons-react"

export interface ImageCropperModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageFile: File | null
  aspectRatio?: "square" | "banner" | "sidebar"
  title?: string
  onCropComplete: (croppedFile: File) => void
}

// Pure helper function to clamp pan within crop boundaries
function clampPosition(
  pos: { x: number; y: number },
  naturalSize: { width: number; height: number } | null,
  cropBox: { width: number; height: number },
  minScale: number,
  zoom: number,
  rotation: number
): { x: number; y: number } {
  if (!naturalSize || cropBox.width === 0 || cropBox.height === 0) {
    return { x: 0, y: 0 }
  }

  const isRotated = rotation === 90 || rotation === 270
  const effectiveW = isRotated ? naturalSize.height : naturalSize.width
  const effectiveH = isRotated ? naturalSize.width : naturalSize.height

  // Displayed rotated dimensions
  const dispW = effectiveW * minScale * zoom
  const dispH = effectiveH * minScale * zoom

  const maxX = Math.max(0, (dispW - cropBox.width) / 2)
  const maxY = Math.max(0, (dispH - cropBox.height) / 2)

  return {
    x: Math.min(Math.max(pos.x, -maxX), maxX),
    y: Math.min(Math.max(pos.y, -maxY), maxY),
  }
}

export function ImageCropperModal({
  open,
  onOpenChange,
  imageFile,
  aspectRatio = "square",
  title,
  onCropComplete,
}: ImageCropperModalProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.profile")
  const modalTitle = title ?? t("cropImage")
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{
    width: number
    height: number
  } | null>(null)
  const [cropBoxSize, setCropBoxSize] = useState<{
    width: number
    height: number
  }>({ width: 0, height: 0 })
  const [minScale, setMinScale] = useState(1)

  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // Aspect ratio proportions (width / height)
  const targetRatio =
    aspectRatio === "banner"
      ? 16 / 5.5 // ~2.9:1 wide banner
      : aspectRatio === "sidebar"
        ? 2 / 1 // 2:1 for sidebar cards
        : 1 // 1:1 for avatar / square

  // Load image when imageFile changes
  useEffect(() => {
    if (!imageFile || !open) {
      setImageSrc(null)
      setNaturalSize(null)
      return
    }
    const objectUrl = URL.createObjectURL(imageFile)
    setImageSrc(objectUrl)
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setPosition({ x: 0, y: 0 })

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [imageFile, open])

  // Measure crop box and calculate minimum scale to cover crop box completely
  const measureAndUpdate = useCallback(() => {
    if (!containerRef.current || !naturalSize) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    if (containerWidth === 0 || containerHeight === 0) return

    // Crop box dimensions inside viewport
    let cWidth = containerWidth * 0.92
    let cHeight = cWidth / targetRatio

    if (cHeight > containerHeight * 0.82) {
      cHeight = containerHeight * 0.82
      cWidth = cHeight * targetRatio
    }

    const isRotated = rotation === 90 || rotation === 270
    const effectiveW = isRotated ? naturalSize.height : naturalSize.width
    const effectiveH = isRotated ? naturalSize.width : naturalSize.height

    // Scale required so image fully covers crop box without gaps
    const scale = Math.max(cWidth / effectiveW, cHeight / effectiveH)

    setCropBoxSize({ width: cWidth, height: cHeight })
    setMinScale(scale)
    setPosition((prev) =>
      clampPosition(
        prev,
        naturalSize,
        { width: cWidth, height: cHeight },
        scale,
        zoom,
        rotation
      )
    )
  }, [naturalSize, targetRatio, rotation, zoom])

  useEffect(() => {
    if (!open || !naturalSize) return
    measureAndUpdate()
    window.addEventListener("resize", measureAndUpdate)
    return () => window.removeEventListener("resize", measureAndUpdate)
  }, [open, naturalSize, measureAndUpdate])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setNaturalSize({
      width: img.naturalWidth,
      height: img.naturalHeight,
    })
  }

  // Drag handling with clamping
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !naturalSize) return
      const rawPos = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }
      setPosition(
        clampPosition(
          rawPos,
          naturalSize,
          cropBoxSize,
          minScale,
          zoom,
          rotation
        )
      )
    },
    [isDragging, dragStart, naturalSize, cropBoxSize, minScale, zoom, rotation]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
      return () => {
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Touch Support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && e.touches[0]) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !naturalSize || e.touches.length !== 1 || !e.touches[0])
      return
    const rawPos = {
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    }
    setPosition(
      clampPosition(rawPos, naturalSize, cropBoxSize, minScale, zoom, rotation)
    )
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setZoom((prev) => {
      const nextZoom = Math.min(Math.max(prev + delta, 1.0), 3.0)
      if (naturalSize) {
        setPosition((currentPos) =>
          clampPosition(
            currentPos,
            naturalSize,
            cropBoxSize,
            minScale,
            nextZoom,
            rotation
          )
        )
      }
      return nextZoom
    })
  }

  const handleZoomChange = (nextZoom: number) => {
    setZoom(nextZoom)
    if (naturalSize) {
      setPosition((currentPos) =>
        clampPosition(
          currentPos,
          naturalSize,
          cropBoxSize,
          minScale,
          nextZoom,
          rotation
        )
      )
    }
  }

  const handleRotate = (deg: number) => {
    setRotation((prev) => {
      const nextRot = (prev + deg + 360) % 360
      if (naturalSize) {
        setPosition((currentPos) =>
          clampPosition(
            currentPos,
            naturalSize,
            cropBoxSize,
            minScale,
            zoom,
            nextRot
          )
        )
      }
      return nextRot
    })
  }

  // Reset transforms
  const handleReset = () => {
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    setPosition({ x: 0, y: 0 })
  }

  // Perform canvas crop and export cropped File
  const handleSaveCrop = async () => {
    if (!imageRef.current || !naturalSize || cropBoxSize.width === 0) return
    setIsProcessing(true)

    try {
      // Output target resolutions
      let outWidth = 512
      let outHeight = 512

      if (aspectRatio === "banner") {
        outWidth = 1200
        outHeight = 400
      } else if (aspectRatio === "sidebar") {
        outWidth = 800
        outHeight = 400
      }

      const canvas = document.createElement("canvas")
      canvas.width = outWidth
      canvas.height = outHeight
      const ctx = canvas.getContext("2d")

      if (!ctx) throw new Error("Could not initialize canvas context.")

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      // 1. Center canvas for rotation & flipping
      ctx.translate(outWidth / 2, outHeight / 2)

      // 2. Rotate canvas
      ctx.rotate((rotation * Math.PI) / 180)

      // 3. Flip canvas
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)

      // 4. Calculate scale factor between on-screen crop box and high-res canvas
      const scaleToCanvas = outWidth / cropBoxSize.width
      const scaledDispW = naturalSize.width * minScale * zoom * scaleToCanvas
      const scaledDispH = naturalSize.height * minScale * zoom * scaleToCanvas

      // Un-rotated position mapped to canvas coordinates
      let drawOffsetX = position.x * scaleToCanvas
      let drawOffsetY = position.y * scaleToCanvas

      if (rotation === 90) {
        const temp = drawOffsetX
        drawOffsetX = drawOffsetY
        drawOffsetY = -temp
      } else if (rotation === 180) {
        drawOffsetX = -drawOffsetX
        drawOffsetY = -drawOffsetY
      } else if (rotation === 270) {
        const temp = drawOffsetX
        drawOffsetX = -drawOffsetY
        drawOffsetY = temp
      }

      if (flipH) drawOffsetX = -drawOffsetX
      if (flipV) drawOffsetY = -drawOffsetY

      // 5. Draw source image into transformed canvas
      ctx.drawImage(
        imageRef.current,
        -scaledDispW / 2 + drawOffsetX,
        -scaledDispH / 2 + drawOffsetY,
        scaledDispW,
        scaledDispH
      )

      // 6. Convert canvas blob to File
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/webp", 0.92)
      )

      if (!blob) throw new Error("Failed to encode cropped image.")

      const fileName = `${imageFile?.name?.replace(/\.[^/.]+$/, "") || "asset"}-cropped.webp`
      const croppedFile = new File([blob], fileName, { type: "image/webp" })

      onCropComplete(croppedFile)
      onOpenChange(false)
    } catch (err) {
      console.error("Crop error:", err)
    } finally {
      setIsProcessing(false)
    }
  }

  const baseImageWidth = naturalSize ? naturalSize.width * minScale : 0
  const baseImageHeight = naturalSize ? naturalSize.height * minScale : 0

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="w-[95vw] gap-0 overflow-hidden rounded-3xl border border-border/80 bg-card/95 p-0 backdrop-blur-xl sm:max-w-3xl md:max-w-4xl"
    >
      <DialogHeader className="p-5 pb-3">
        <DialogTitle className="text-base font-bold text-foreground">
          {modalTitle}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4 px-5">
        {/* Main Crop Viewport */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="relative isolate flex h-80 w-full cursor-grab items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-black/95 select-none active:cursor-grabbing sm:h-96 md:h-105"
        >
          {/* Transforming Image (strictly clamped within crop boundaries) */}
          {imageSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop target"
              onLoad={handleImageLoad}
              draggable={false}
              className="pointer-events-none absolute max-w-none transition-transform duration-75 select-none"
              style={{
                width: baseImageWidth ? `${baseImageWidth}px` : "auto",
                height: baseImageHeight ? `${baseImageHeight}px` : "auto",
                transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${
                  flipH ? -zoom : zoom
                }, ${flipV ? -zoom : zoom})`,
              }}
            />
          )}

          {/* Crop Frame Overlay (dimmed backdrop + cutout box) */}
          {cropBoxSize.width > 0 && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div
                className="relative border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-all"
                style={{
                  width: `${cropBoxSize.width}px`,
                  height: `${cropBoxSize.height}px`,
                  borderRadius: aspectRatio === "square" ? "9999px" : "16px",
                }}
              >
                {/* Corner guides */}
                <div className="absolute -top-1.5 -left-1.5 size-4 border-t-2 border-l-2 border-white" />
                <div className="absolute -top-1.5 -right-1.5 size-4 border-t-2 border-r-2 border-white" />
                <div className="absolute -bottom-1.5 -left-1.5 size-4 border-b-2 border-l-2 border-white" />
                <div className="absolute -right-1.5 -bottom-1.5 size-4 border-r-2 border-b-2 border-white" />
              </div>
            </div>
          )}
        </div>

        {/* Transformation Action Buttons Bar */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/50 bg-background/50 p-1.5 sm:grid-cols-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => handleRotate(-90)}
            className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconRotate data-icon="inline-start" className="size-4" />
            {t("rotateL")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => handleRotate(90)}
            className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconRotateClockwise data-icon="inline-start" className="size-4" />
            {t("rotateR")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => setFlipH((prev) => !prev)}
            className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconFlipHorizontal data-icon="inline-start" className="size-4" />
            {t("flipH")}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => setFlipV((prev) => !prev)}
            className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconFlipVertical data-icon="inline-start" className="size-4" />
            {t("flipV")}
          </Button>
        </div>

        {/* Zoom Slider Control */}
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/40 px-3.5 py-2">
          <IconPhoto className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1.0}
            max={3.0}
            step={0.02}
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer rounded-lg bg-muted accent-primary"
          />
          <IconPhoto className="size-5 shrink-0 text-muted-foreground" />

          <button
            type="button"
            onClick={handleReset}
            title={t("resetTransformationsTitle")}
            className="ml-1 cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <IconRotate2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Modal Footer */}
      <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/40 p-5 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isProcessing}
          onPress={() => onOpenChange(false)}
          className="h-9 cursor-pointer rounded-xl px-4 text-xs"
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={isProcessing}
          onPress={handleSaveCrop}
          className="h-9 cursor-pointer rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground"
        >
          {isProcessing ? (
            <>
              <Spinner className="size-3.5" />
              <span>{t("savingCrop")}</span>
            </>
          ) : (
            <span>{t("saveCrop")}</span>
          )}
        </Button>
      </div>
    </Dialog>
  )
}
