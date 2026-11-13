"use client"

import React, { useState, useMemo } from "react"
import {
  IconCircleCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconCopy,
  IconCheck,
  IconSearch,
  IconCode,
} from "@tabler/icons-react"
import type {
  PageMetadataInfo,
  DiagnosticItem,
  DiagnosticStatus,
} from "./types"

interface MetadataDiagnosticsProps {
  metadata: PageMetadataInfo
  diagnostics: DiagnosticItem[]
}

export function MetadataDiagnostics({
  metadata,
  diagnostics,
}: MetadataDiagnosticsProps) {
  const [activeSubTab, setActiveSubTab] = useState<"checklist" | "raw">(
    "checklist"
  )
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState("")

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // fallback
    }
  }

  // Filter raw tags
  const filteredTags = useMemo(() => {
    if (!searchFilter.trim()) return metadata.rawTags
    const q = searchFilter.toLowerCase()
    return metadata.rawTags.filter(
      (t) =>
        t.key.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q) ||
        t.rawHtml.toLowerCase().includes(q)
    )
  }, [metadata.rawTags, searchFilter])

  // Generate Next.js Metadata snippet
  const nextjsSnippet = useMemo(() => {
    return `import type { Metadata } from "next"

export const metadata: Metadata = {
  title: ${JSON.stringify(metadata.title || "")},
  description: ${JSON.stringify(metadata.description || "")},
  openGraph: {
    title: ${JSON.stringify(metadata.openGraph.title || metadata.title || "")},
    description: ${JSON.stringify(metadata.openGraph.description || metadata.description || "")},
    siteName: ${JSON.stringify(metadata.openGraph.siteName || "IRIS")},
    ${
      metadata.openGraph.image
        ? `images: [{ url: ${JSON.stringify(metadata.openGraph.image)} }],`
        : `// images: [{ url: "/og-image.png" }],`
    }
  },
  twitter: {
    card: ${JSON.stringify(metadata.twitter.card || "summary_large_image")},
    title: ${JSON.stringify(metadata.twitter.title || metadata.title || "")},
    description: ${JSON.stringify(metadata.twitter.description || metadata.description || "")},
    ${
      metadata.twitter.image
        ? `images: [${JSON.stringify(metadata.twitter.image)}],`
        : `// images: ["/og-image.png"],`
    }
  },
}`
  }, [metadata])

  // Generate raw HTML tags snippet
  const rawHtmlSnippet = useMemo(() => {
    return metadata.rawTags.map((t) => t.rawHtml).join("\n")
  }, [metadata.rawTags])

  return (
    <div className="flex flex-col gap-4">
      {/* Subtab navigation */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-muted/60 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab("checklist")}
            className={`rounded-lg px-3 py-1 font-medium transition-all ${
              activeSubTab === "checklist"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Health Checklist ({diagnostics.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("raw")}
            className={`rounded-lg px-3 py-1 font-medium transition-all ${
              activeSubTab === "raw"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Raw &lt;head&gt; Tags ({metadata.rawTags.length})
          </button>
        </div>

        {/* Quick copy actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => copyToClipboard(nextjsSnippet, "nextjs")}
            className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Copy as Next.js Metadata TypeScript object"
          >
            {copiedKey === "nextjs" ? (
              <IconCheck className="size-3 text-emerald-500" />
            ) : (
              <IconCode className="size-3" />
            )}
            <span>
              {copiedKey === "nextjs" ? "Copied Next.js!" : "Copy Next.js"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => copyToClipboard(rawHtmlSnippet, "html")}
            className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Copy all raw HTML meta tags"
          >
            {copiedKey === "html" ? (
              <IconCheck className="size-3 text-emerald-500" />
            ) : (
              <IconCopy className="size-3" />
            )}
            <span>{copiedKey === "html" ? "Copied HTML!" : "Copy HTML"}</span>
          </button>
        </div>
      </div>

      {/* CHECKLIST VIEW */}
      {activeSubTab === "checklist" && (
        <div className="flex flex-col gap-2.5">
          {diagnostics.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-xl border p-3 text-xs transition-colors ${
                item.status === "pass"
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-950 dark:text-emerald-200"
                  : item.status === "warn"
                    ? "border-amber-500/20 bg-amber-500/5 text-amber-950 dark:text-amber-200"
                    : item.status === "fail"
                      ? "border-rose-500/20 bg-rose-500/5 text-rose-950 dark:text-rose-200"
                      : "border-blue-500/20 bg-blue-500/5 text-blue-950 dark:text-blue-200"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {item.status === "pass" && (
                  <IconCircleCheck className="size-4 text-emerald-500" />
                )}
                {item.status === "warn" && (
                  <IconAlertTriangle className="size-4 text-amber-500" />
                )}
                {item.status === "fail" && (
                  <IconAlertCircle className="size-4 text-rose-500" />
                )}
                {item.status === "info" && (
                  <IconInfoCircle className="size-4 text-blue-500" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {item.label}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                      item.status === "pass"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : item.status === "warn"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : item.status === "fail"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="leading-relaxed text-muted-foreground">
                  {item.message}
                </div>

                {item.value && (
                  <div className="max-w-full truncate rounded border border-border/50 bg-background/80 px-2 py-1 font-mono text-[11px] text-foreground/80">
                    {item.value}
                  </div>
                )}

                {item.recommendation && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground/80 italic">
                    💡 {item.recommendation}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RAW TAGS VIEW */}
      {activeSubTab === "raw" && (
        <div className="flex flex-col gap-3">
          {/* Search bar */}
          <div className="relative">
            <IconSearch className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter tags (e.g. og:, twitter, canonical)..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-muted/40 py-1.5 ps-9 pe-3 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-rose-500 focus:outline-none"
            />
          </div>

          {/* Tags list */}
          <div className="flex max-h-[460px] flex-col gap-1.5 overflow-y-auto pe-1">
            {filteredTags.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No matching tags found.
              </div>
            ) : (
              filteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className="group flex items-start justify-between gap-2 rounded-lg border border-border/40 bg-card/60 p-2 transition-colors hover:border-border hover:bg-card"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-mono text-[11px] font-semibold text-rose-500 dark:text-rose-400">
                      {tag.key}
                    </span>
                    <span className="font-mono text-xs break-all text-foreground">
                      {tag.value || (
                        <em className="text-muted-foreground">empty</em>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(tag.rawHtml, tag.id)}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                    title="Copy tag HTML"
                  >
                    {copiedKey === tag.id ? (
                      <IconCheck className="size-3.5 text-emerald-500" />
                    ) : (
                      <IconCopy className="size-3.5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
