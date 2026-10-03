"use client"

import React, { useState, useEffect } from "react"
import {
  IconSeo,
  IconX,
  IconRefresh,
  IconPin,
  IconEye,
  IconCircleCheck,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { usePageMetadata } from "./use-page-metadata"
import { PlatformPreviews } from "./platform-previews"
import { MetadataDiagnostics } from "./metadata-diagnostics"
import type { DevToolCorner, SocialPlatformId } from "./types"

const STORAGE_KEY_CORNER = "iris_metadata_devtool_corner"

export function MetadataDevTool() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"previews" | "diagnostics">(
    "previews"
  )
  const [selectedPlatform, setSelectedPlatform] =
    useState<SocialPlatformId>("discord")
  const [corner, setCorner] = useState<DevToolCorner>("bottom-end")
  const [showCornerMenu, setShowCornerMenu] = useState(false)

  const { metadata, diagnostics, passCount, warnCount, refresh } =
    usePageMetadata()

  // Load saved corner preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(
        STORAGE_KEY_CORNER
      ) as DevToolCorner | null
      if (
        saved &&
        ["bottom-end", "bottom-start", "top-end", "top-start"].includes(saved)
      ) {
        setCorner(saved)
      }
    } catch {
      // localStorage unavailable or restricted
    }
  }, [])

  const changeCorner = (newCorner: DevToolCorner) => {
    setCorner(newCorner)
    setShowCornerMenu(false)
    try {
      localStorage.setItem(STORAGE_KEY_CORNER, newCorner)
    } catch {
      // ignore
    }
  }

  // Corner positioning classes for floating trigger
  const cornerPositionClass = {
    "bottom-end": "bottom-4 end-4",
    "bottom-start": "bottom-4 start-4",
    "top-end": "top-4 end-4",
    "top-start": "top-4 start-4",
  }[corner]

  // Drawer slide position based on corner
  const drawerSide = corner.includes("start") ? "start" : "end"

  return (
    <>
      {/* Floating Trigger Badge */}
      {!isOpen && (
        <div
          className={`fixed ${cornerPositionClass} z-50 flex items-center gap-1.5 select-none`}
        >
          <div className="group relative">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 rounded-full border border-border/80 bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 hover:border-rose-500/50 hover:shadow-rose-500/10 active:scale-95"
              title="Open Metadata & Social Previews DevTool"
            >
              <IconSeo className="size-4 text-rose-500" />
              <span className="hidden font-mono text-[11px] text-muted-foreground group-hover:text-foreground sm:inline">
                Metadata
              </span>

              {/* Status pill indicator */}
              {warnCount > 0 ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-black">
                  {warnCount}
                </span>
              ) : (
                <span className="flex size-2 items-center justify-center rounded-full bg-emerald-500" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Drawer Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex overflow-hidden">
          {/* Subtle backdrop overlay - click to close */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Container */}
          <div
            className={`fixed inset-y-0 ${
              drawerSide === "start" ? "start-0" : "end-0"
            } z-50 flex w-full max-w-[540px] transform flex-col border-x border-border bg-background/98 shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out`}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-muted/20 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-500">
                  <IconSeo className="size-4.5" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm font-semibold text-foreground">
                      Metadata & Social DevTool
                    </span>
                    <span className="py-0.2 rounded border border-rose-500/20 bg-rose-500/10 px-1.5 font-mono text-[10px] font-semibold text-rose-500 uppercase">
                      DEV
                    </span>
                  </div>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {metadata.pathname || "/"}
                  </span>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-1">
                {/* Refresh */}
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                  title="Re-inspect document.head"
                >
                  <IconRefresh className="size-4" />
                </button>

                {/* Corner Docking Selector */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCornerMenu(!showCornerMenu)}
                    className={`rounded-lg p-1.5 transition-colors ${
                      showCornerMenu
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    }`}
                    title="Change corner dock location"
                  >
                    <IconPin className="size-4" />
                  </button>

                  {/* Corner Dropdown */}
                  {showCornerMenu && (
                    <div
                      className={`absolute top-full mt-1 ${
                        drawerSide === "start" ? "start-0" : "end-0"
                      } z-50 flex w-44 flex-col gap-1 rounded-xl border border-border bg-popover p-2 text-xs font-medium text-popover-foreground shadow-xl`}
                    >
                      <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                        Pin launcher to
                      </div>
                      {(
                        [
                          { id: "bottom-end", label: "Bottom Right" },
                          { id: "bottom-start", label: "Bottom Left" },
                          { id: "top-end", label: "Top Right" },
                          { id: "top-start", label: "Top Left" },
                        ] as const
                      ).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => changeCorner(c.id)}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-start transition-colors ${
                            corner === c.id
                              ? "bg-rose-500/10 font-semibold text-rose-500"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <span>{c.label}</span>
                          {corner === c.id && (
                            <span className="size-1.5 rounded-full bg-rose-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Close Drawer */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                  title="Close DevTool"
                >
                  <IconX className="size-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center border-b border-border/70 bg-background px-5">
              <button
                type="button"
                onClick={() => setActiveTab("previews")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === "previews"
                    ? "border-rose-500 font-semibold text-rose-500"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <IconEye className="size-3.5" />
                <span>Social Previews</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("diagnostics")}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeTab === "diagnostics"
                    ? "border-rose-500 font-semibold text-rose-500"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {warnCount > 0 ? (
                  <IconAlertTriangle className="size-3.5 text-amber-500" />
                ) : (
                  <IconCircleCheck className="size-3.5 text-emerald-500" />
                )}
                <span>Diagnostics & Tags</span>
                {warnCount > 0 && (
                  <span className="py-0.2 rounded-full bg-amber-500/15 px-1.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {warnCount}
                  </span>
                )}
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "previews" ? (
                <PlatformPreviews
                  metadata={metadata}
                  selectedPlatform={selectedPlatform}
                  onSelectPlatform={setSelectedPlatform}
                />
              ) : (
                <MetadataDiagnostics
                  metadata={metadata}
                  diagnostics={diagnostics}
                />
              )}
            </div>

            {/* Footer Status Bar */}
            <div className="flex items-center justify-between border-t border-border/70 bg-muted/20 px-5 py-2.5 text-[11px] text-muted-foreground">
              <span className="font-mono">
                {passCount} passed · {warnCount} warnings
              </span>
              <span className="text-[10px] italic">
                Only active in NODE_ENV=development
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
