"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { IconPhotoOff, IconFilter } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { getMediaDetailHref } from "@/lib/media-routes"
import { BorealisCard, BorealisCardGroup, type BorealisEntityType } from "@Runa/borealis"
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
                <BorealisCardGroup
                  key={relKey}
                  title={relLabel}
                  rowCount={1}
                  dragFree
                  variant="none"
                >
                  {items.map((rel) => {
                    const rawType = rel.targetType.toLowerCase() as BorealisEntityType
                    const href = getMediaDetailHref(rel.targetType, rel.targetId)

                    return (
                      <BorealisCard
                        key={`${rel.id}-${rel.targetType}-${rel.targetId}`}
                        type={rawType}
                        href={href}
                        titlePreference={titlePreference}
                        showSubtitle={false}
                        showExtras={false}
                        data={{
                          id: rel.targetId,
                          titlePrimary: rel.target?.titlePrimary,
                          titleSecondary: rel.target?.titleSecondary,
                          titleNative: rel.target?.titleNative,
                          coverImage: rel.target?.coverImage,
                          bannerImage: rel.target?.bannerImage,
                          description: rel.target?.description,
                          format: rel.target?.format,
                          status: rel.target?.status,
                          seasonYear: rel.target?.seasonYear,
                          year: rel.target?.seasonYear,
                          score: rel.target?.averageScore,
                          averageScore: rel.target?.averageScore,
                          genres: rel.target?.genres,
                          badges: [
                            {
                              label: rel.type.replace(/_/g, " "),
                              variant: "secondary",
                              className:
                                "bg-frost border border-frost text-zinc-100 font-mono text-[10px] font-bold tracking-wider uppercase shadow-md backdrop-blur-md",
                            },
                          ],
                        }}
                      />
                    )
                  })}
                </BorealisCardGroup>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

