"use client"

import React from "react"
import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTablet,
} from "@tabler/icons-react"
import type { TesseractDeviceType } from "@/lib/tesseract/types"

export function DeviceTypeIcon({
  deviceType,
  className = "size-4",
}: {
  deviceType: TesseractDeviceType
  className?: string
}) {
  if (deviceType === "mobile") {
    return <IconDeviceMobile className={className} />
  }
  if (deviceType === "tablet") {
    return <IconDeviceTablet className={className} />
  }
  return <IconDeviceDesktop className={className} />
}

