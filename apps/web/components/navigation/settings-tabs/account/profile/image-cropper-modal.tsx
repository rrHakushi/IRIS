"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  IconRotate,
  IconRotateClockwise,
  IconFlipHorizontal,
  IconFlipVertical,
  IconPhoto,
  IconRotate2,
} from "@tabler/icons-react";

export interface ImageCropperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile: File | null;
  aspectRatio?: "square" | "banner" | "sidebar";
  title?: string;
  onCropComplete: (croppedFile: File) => void;
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
    return { x: 0, y: 0 };
  }

  const isRotated = rotation === 90 || rotation === 270;
  const effectiveW = isRotated ? naturalSize.height : naturalSize.width;
  const effectiveH = isRotated ? naturalSize.width : naturalSize.height;

  // Displayed rotated dimensions
  const dispW = effectiveW * minScale * zoom;
  const dispH = effectiveH * minScale * zoom;

  const maxX = Math.max(0, (dispW - cropBox.width) / 2);
  const maxY = Math.max(0, (dispH - cropBox.height) / 2);

  return {
    x: Math.min(Math.max(pos.x, -maxX), maxX),
    y: Math.min(Math.max(pos.y, -maxY), maxY),
  };
}

export function ImageCropperModal({
  open,
  onOpenChange,
  imageFile,
  aspectRatio = "square",
  title = "Crop Image",
  onCropComplete,
}: ImageCropperModalProps): React.JSX.Element {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [cropBoxSize, setCropBoxSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [minScale, setMinScale] = useState(1);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Aspect ratio proportions (width / height)
  const targetRatio =
    aspectRatio === "banner"
      ? 16 / 5.5 // ~2.9:1 wide banner
      : aspectRatio === "sidebar"
        ? 2 / 1 // 2:1 for sidebar cards
        : 1; // 1:1 for avatar / square

  // Load image when imageFile changes
  useEffect(() => {
    if (!imageFile || !open) {
      setImageSrc(null);
      setNaturalSize(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImageSrc(objectUrl);
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setPosition({ x: 0, y: 0 });

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile, open]);

  // Measure crop box and calculate minimum scale to cover crop box completely
  const measureAndUpdate = useCallback(() => {
    if (!containerRef.current || !naturalSize) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (containerWidth === 0 || containerHeight === 0) return;

    // Crop box dimensions inside viewport
    let cWidth = containerWidth * 0.92;
    let cHeight = cWidth / targetRatio;

    if (cHeight > containerHeight * 0.82) {
      cHeight = containerHeight * 0.82;
      cWidth = cHeight * targetRatio;
    }

    const isRotated = rotation === 90 || rotation === 270;
    const effectiveW = isRotated ? naturalSize.height : naturalSize.width;
    const effectiveH = isRotated ? naturalSize.width : naturalSize.height;

    // Scale required so image fully covers crop box without gaps
    const scale = Math.max(cWidth / effectiveW, cHeight / effectiveH);

    setCropBoxSize({ width: cWidth, height: cHeight });
    setMinScale(scale);
    setPosition((prev) =>
      clampPosition(prev, naturalSize, { width: cWidth, height: cHeight }, scale, zoom, rotation)
    );
  }, [naturalSize, targetRatio, rotation, zoom]);

  useEffect(() => {
    if (!open || !naturalSize) return;
    measureAndUpdate();
    window.addEventListener("resize", measureAndUpdate);
    return () => window.removeEventListener("resize", measureAndUpdate);
  }, [open, naturalSize, measureAndUpdate]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({
      width: img.naturalWidth || 800,
      height: img.naturalHeight || 600,
    });
  };

  // Drag handling with clamping
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const rawX = e.clientX - dragStart.x;
      const rawY = e.clientY - dragStart.y;
      setPosition(
        clampPosition({ x: rawX, y: rawY }, naturalSize, cropBoxSize, minScale, zoom, rotation)
      );
    },
    [isDragging, dragStart, naturalSize, cropBoxSize, minScale, zoom, rotation]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Touch handling with clamping
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && e.touches[0]) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1 || !e.touches[0]) return;
    const rawX = e.touches[0].clientX - dragStart.x;
    const rawY = e.touches[0].clientY - dragStart.y;
    setPosition(
      clampPosition({ x: rawX, y: rawY }, naturalSize, cropBoxSize, minScale, zoom, rotation)
    );
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    const newZoom = Math.min(Math.max(1, zoom + delta), 3);
    setZoom(newZoom);
    setPosition((prev) =>
      clampPosition(prev, naturalSize, cropBoxSize, minScale, newZoom, rotation)
    );
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setPosition((prev) =>
      clampPosition(prev, naturalSize, cropBoxSize, minScale, newZoom, rotation)
    );
  };

  const handleRotate = (deltaDeg: number) => {
    const nextRot = (rotation + deltaDeg + 360) % 360;
    setRotation(nextRot);
    setPosition((prev) =>
      clampPosition(prev, naturalSize, cropBoxSize, minScale, zoom, nextRot)
    );
  };

  // Reset transforms
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setPosition({ x: 0, y: 0 });
  };

  // Export cropped canvas
  const handleSaveCrop = async () => {
    if (!imageRef.current || !imageFile || !naturalSize || cropBoxSize.width === 0) return;

    setIsProcessing(true);
    try {
      const img = imageRef.current;

      // High-resolution canvas export
      const exportWidth = targetRatio >= 2 ? 1400 : 800;
      const exportHeight = Math.round(exportWidth / targetRatio);

      const canvas = document.createElement("canvas");
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Could not get canvas context");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Scale between export canvas and on-screen crop box
      const canvasScale = exportWidth / cropBoxSize.width;

      // Translate to canvas center
      ctx.translate(exportWidth / 2, exportHeight / 2);

      // Translate by clamped pan offset
      ctx.translate(position.x * canvasScale, position.y * canvasScale);

      // Apply rotation and flips
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      // Displayed dimensions on canvas
      const drawWidth = naturalSize.width * minScale * zoom * canvasScale;
      const drawHeight = naturalSize.height * minScale * zoom * canvasScale;

      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );

      // Convert canvas to Blob / File
      const mimeType =
        imageFile.type === "image/png" || imageFile.type === "image/svg+xml"
          ? "image/png"
          : "image/webp";

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), mimeType, 0.92);
      });

      if (!blob) throw new Error("Failed to render cropped image blob");

      const extension = mimeType === "image/png" ? "png" : "webp";
      const croppedFile = new File(
        [blob],
        `cropped-${Date.now()}.${extension}`,
        { type: mimeType }
      );

      onCropComplete(croppedFile);
      onOpenChange(false);
    } catch (err) {
      console.error("Crop error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const baseImageWidth = naturalSize ? naturalSize.width * minScale : 0;
  const baseImageHeight = naturalSize ? naturalSize.height * minScale : 0;

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="w-[95vw] sm:max-w-3xl md:max-w-4xl p-0 gap-0 overflow-hidden bg-card/95 backdrop-blur-xl border border-border/80 rounded-3xl"
    >
      <DialogHeader className="p-5 pb-3">
        <DialogTitle className="text-base font-bold text-foreground">
          {title}
        </DialogTitle>
      </DialogHeader>

      <div className="px-5 space-y-4">
        {/* Main Crop Viewport */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="relative h-80 sm:h-96 md:h-105 w-full rounded-2xl bg-black/95 overflow-hidden cursor-grab active:cursor-grabbing border border-border/60 select-none flex items-center justify-center isolate"
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
              className="absolute max-w-none pointer-events-none select-none transition-transform duration-75"
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
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
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
                <div className="absolute -bottom-1.5 -right-1.5 size-4 border-b-2 border-r-2 border-white" />
              </div>
            </div>
          )}
        </div>

        {/* Transformation Action Buttons Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-background/50 p-1.5 rounded-2xl border border-border/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => handleRotate(-90)}
            className="h-8 text-xs font-medium gap-1.5 rounded-xl cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <IconRotate data-icon="inline-start" className="size-4" />
            Rotate L
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => handleRotate(90)}
            className="h-8 text-xs font-medium gap-1.5 rounded-xl cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <IconRotateClockwise data-icon="inline-start" className="size-4" />
            Rotate R
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => setFlipH((prev) => !prev)}
            className="h-8 text-xs font-medium gap-1.5 rounded-xl cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <IconFlipHorizontal data-icon="inline-start" className="size-4" />
            Flip H
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => setFlipV((prev) => !prev)}
            className="h-8 text-xs font-medium gap-1.5 rounded-xl cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <IconFlipVertical data-icon="inline-start" className="size-4" />
            Flip V
          </Button>
        </div>

        {/* Zoom Slider Control */}
        <div className="flex items-center gap-3 bg-background/40 px-3.5 py-2 rounded-2xl border border-border/50">
          <IconPhoto className="size-4 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={1.0}
            max={3.0}
            step={0.02}
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="flex-1 accent-primary cursor-pointer h-1.5 bg-muted rounded-lg"
          />
          <IconPhoto className="size-5 text-muted-foreground shrink-0" />

          <button
            type="button"
            onClick={handleReset}
            title="Reset transformations"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ml-1"
          >
            <IconRotate2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Modal Footer */}
      <div className="p-5 pt-3 flex items-center justify-end gap-2 border-t border-border/40 mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isProcessing}
          onPress={() => onOpenChange(false)}
          className="text-xs h-9 px-4 rounded-xl cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={isProcessing}
          onPress={handleSaveCrop}
          className="text-xs h-9 px-5 rounded-xl font-bold cursor-pointer bg-primary text-primary-foreground"
        >
          {isProcessing ? (
            <>
              <Spinner className="size-3.5" />
              <span>Saving Crop...</span>
            </>
          ) : (
            <span>Save Crop</span>
          )}
        </Button>
      </div>
    </Dialog>
  );
}
