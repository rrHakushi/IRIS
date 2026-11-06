"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { IconPhotoOff, IconFilter } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { getMediaDetailHref } from "@/lib/media-routes"
import type { RelationItem } from "../media-types"

interface RelationsTabProps {
  relations: RelationItem[]
  titlePreference?: "primary" | "secondary" | "native"
}

const TYPE_ORDER: Record<string, { label: string; priority: number }> = {
  ANIME: { label: "Anime", priority: 1 },
  MANGA: { label: "Manga", priority: 2 },
  BOOK: { label: "Light Novels & Books", priority: 3 },
  TV: { label: "TV Shows", priority: 4 },
  MOVIE: { label: "Movies", priority: 5 },
  GAME: { label: "Games", priority: 6 },
  MUSIC: { label: "Music", priority: 7 },
  OTHER: { label: "Other Media", priority: 8 },
}

const RELATION_ORDER: Record<string, { label: string; priority: number }> = {
  PREQUEL: { label: "Prequel", priority: 1 },
  SEQUEL: { label: "Sequel", priority: 2 },
  ADAPTATION: { label: "Adaptation", priority: 3 },
  SIDE_STORY: { label: "Side Story", priority: 4 },
  SPIN_OFF: { label: "Spin-Off", priority: 5 },
  ALTERNATIVE: { label: "Alternative Setting / Version", priority: 6 },
  SUMMARY: { label: "Summary", priority: 7 },
  CHARACTER: { label: "Character Story", priority: 8 },
  OTHER: { label: "Other Relation", priority: 9 },
}

function formatTitle(
  target: RelationItem["target"],
  pref: "primary" | "secondary" | "native" = "primary"
): string {
  if (!target) return "Untitled"
  if (pref === "secondary" && target.titleSecondary) return target.titleSecondary
  if (pref === "native" && target.titleNative) return target.titleNative
  return target.titlePrimary || target.titleSecondary || target.titleNative || "Untitled"
}

export function RelationsTab({
  relations,
  titlePreference = "primary",
}: RelationsTabProps) {
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL")

  // Available unique types for filter bar
  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    for (const rel of relations) {
      set.add(rel.targetType.toUpperCase())
    }
    return Array.from(set).sort((a, b) => {
      const pA = TYPE_ORDER[a]?.priority ?? 99
      const pB = TYPE_ORDER[b]?.priority ?? 99
      return pA - pB
    })
  }, [relations])

  // Group by Type, then within each Type, group by Relation
  const groupedRelations = useMemo(() => {
    // 1. Group by Type
    const typeMap = new Map<string, RelationItem[]>()
    for (const rel of relations) {
      const rawType = rel.targetType.toUpperCase()
      if (selectedTypeFilter !== "ALL" && rawType !== selectedTypeFilter) {
        continue
      }
      const list = typeMap.get(rawType) ?? []
      list.push(rel)
      typeMap.set(rawType, list)
    }

    // Sort Types by priority
    const sortedTypes = Array.from(typeMap.entries()).sort(([typeA], [typeB]) => {
      const pA = TYPE_ORDER[typeA]?.priority ?? 99
      const pB = TYPE_ORDER[typeB]?.priority ?? 99
      return pA - pB
    })

    return sortedTypes.map(([typeKey, typeItems]) => {
      // 2. Group within this type by Relation
      const relMap = new Map<string, RelationItem[]>()
      for (const item of typeItems) {
        const rawRel = item.type.toUpperCase()
        const list = relMap.get(rawRel) ?? []
        list.push(item)
        relMap.set(rawRel, list)
      }

      // Sort relations by priority
      const sortedRelations = Array.from(relMap.entries()).sort(
        ([relA], [relB]) => {
          const pA = RELATION_ORDER[relA]?.priority ?? 99
          const pB = RELATION_ORDER[relB]?.priority ?? 99
          return pA - pB
        }
      )

      return {
        typeKey,
        typeLabel: TYPE_ORDER[typeKey]?.label ?? typeKey,
        totalCount: typeItems.length,
        relations: sortedRelations.map(([relKey, items]) => ({
          relKey,
          relLabel:
            RELATION_ORDER[relKey]?.label ??
            relKey
              .replace(/_/g, " ")
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(" "),
          items,
        })),
      }
    })
  }, [relations, selectedTypeFilter])

  if (!relations || relations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No relations available for this title.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Type Filter Bar */}
      {availableTypes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 flex items-center gap-1 text-xs text-muted-foreground">
            <IconFilter className="size-3.5" aria-hidden="true" />
            <span>Filter:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedTypeFilter("ALL")}
            className={`rounded-xl px-2.5 py-1 text-xs font-medium outline-none transition-colors select-none ${
              selectedTypeFilter === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            All ({relations.length})
          </button>
          {availableTypes.map((typeKey) => {
            const label = TYPE_ORDER[typeKey]?.label ?? typeKey
            const count = relations.filter(
              (r) => r.targetType.toUpperCase() === typeKey
            ).length
            const isActive = selectedTypeFilter === typeKey
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setSelectedTypeFilter(typeKey)}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium outline-none transition-colors select-none ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Relations Grouped by Type then Relation */}
      <div className="flex flex-col gap-10">
        {groupedRelations.map(({ typeKey, typeLabel, totalCount, relations: relGroups }) => (
          <section
            key={typeKey}
            aria-labelledby={`relation-type-${typeKey}`}
            className="flex flex-col gap-6 rounded-2xl border border-border/40 bg-card/40 p-4 sm:p-6"
          >
            {/* Type Header */}
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2.5">
                <h3
                  id={`relation-type-${typeKey}`}
                  className="text-base font-bold text-foreground"
                >
                  {typeLabel}
                </h3>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                  {totalCount}
                </span>
              </div>
            </div>

            {/* Relation Sub-sections */}
            <div className="flex flex-col gap-6">
              {relGroups.map(({ relKey, relLabel, items }) => (
                <div key={relKey} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/10 text-primary text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5"
                    >
                      {relLabel}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ({items.length})
                    </span>
                  </div>

                  {/* Media Card Grid */}
                  <div className="grid grid-cols-[repeat(auto-fill,140px)] gap-3 sm:gap-4">
                    {items.map((rel) => {
                      const targetTitle = formatTitle(rel.target, titlePreference)
                      const targetCover = rel.target?.coverImage ?? null
                      const targetFormat = rel.target?.format ?? null
                      const href = getMediaDetailHref(rel.targetType, rel.targetId)

                      return (
                        <Link
                          key={`${rel.id}-${rel.targetType}-${rel.targetId}`}
                          href={href}
                          className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                        >
                          {/* Poster Image */}
                          <div className="relative aspect-2/3 w-full overflow-hidden bg-muted">
                            {targetCover ? (
                              <img
                                src={targetCover}
                                alt={targetTitle}
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                                <IconPhotoOff className="size-6" aria-hidden="true" />
                              </div>
                            )}

                            {/* Top Badges */}
                            <div className="absolute start-1.5 top-1.5 flex flex-wrap gap-1">
                              {targetFormat && (
                                <Badge
                                  variant="secondary"
                                  className="h-4 bg-black/80 px-1.5 py-0 text-[9px] font-semibold text-white/90 uppercase backdrop-blur-md"
                                >
                                  {targetFormat}
                                </Badge>
                              )}
                            </div>

                            {/* Bottom Relation Badge */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-1.5 pt-4">
                              <Badge
                                variant="secondary"
                                className="h-4 px-1.5 py-0 text-[8px] font-bold tracking-wider text-white uppercase backdrop-blur-xs"
                              >
                                {rel.type.replace(/_/g, " ")}
                              </Badge>
                            </div>
                          </div>

                          {/* Card Meta */}
                          <div className="flex flex-1 flex-col gap-0.5 p-2">
                            <span className="line-clamp-2 text-xs font-medium text-foreground group-hover:underline">
                              {targetTitle}
                            </span>
                            {rel.target?.seasonYear && (
                              <span className="text-[10px] text-muted-foreground">
                                {rel.target.seasonYear}
                              </span>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

