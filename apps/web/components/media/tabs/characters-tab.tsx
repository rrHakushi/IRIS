"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { IconPhotoOff, IconWorld } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { CharacterItem } from "../media-types"

interface CharactersTabProps {
  characters: CharacterItem[]
}

export function CharactersTab({ characters }: CharactersTabProps) {
  // Detect available languages
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>()
    for (const c of characters) {
      if (c.actor?.language) {
        langs.add(c.actor.language)
      }
    }
    const list = Array.from(langs).sort()
    // Prioritize Japanese, English, Korean
    const ordered = []
    if (list.includes("Japanese")) ordered.push("Japanese")
    if (list.includes("English")) ordered.push("English")
    for (const l of list) {
      if (l !== "Japanese" && l !== "English") ordered.push(l)
    }
    return ordered
  }, [characters])

  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return availableLanguages.includes("Japanese")
      ? "Japanese"
      : availableLanguages[0] || "All"
  })

  // Group characters by characterId so multiple VAs can be resolved
  const uniqueCharacters = useMemo(() => {
    const map = new Map<
      number,
      {
        characterId: number
        namePrimary: string
        nameNative: string | null
        image: string | null
        role: string
        order: number | null
        actorsByLang: Map<string, CharacterItem["actor"]>
        defaultActor: CharacterItem["actor"]
      }
    >()

    for (const item of characters) {
      let existing = map.get(item.characterId)
      if (!existing) {
        existing = {
          characterId: item.characterId,
          namePrimary: item.namePrimary,
          nameNative: item.nameNative,
          image: item.image,
          role: item.role,
          order: item.order,
          actorsByLang: new Map(),
          defaultActor: item.actor,
        }
        map.set(item.characterId, existing)
      }

      if (item.actor?.language) {
        existing.actorsByLang.set(item.actor.language, item.actor)
      } else if (item.actor) {
        existing.actorsByLang.set("Unknown", item.actor)
      }
    }

    const array = Array.from(map.values())
    array.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    return array
  }, [characters])

  // Split characters by role: MAIN, SUPPORTING, BACKGROUND, and any other
  const groupedCharacters = useMemo(() => {
    const main = uniqueCharacters.filter(
      (c) => c.role.toUpperCase() === "MAIN"
    )
    const supporting = uniqueCharacters.filter(
      (c) => c.role.toUpperCase() === "SUPPORTING"
    )
    const background = uniqueCharacters.filter(
      (c) => c.role.toUpperCase() === "BACKGROUND"
    )
    const other = uniqueCharacters.filter((c) => {
      const r = c.role.toUpperCase()
      return r !== "MAIN" && r !== "SUPPORTING" && r !== "BACKGROUND"
    })

    const groups: Array<{
      key: string
      title: string
      items: typeof uniqueCharacters
    }> = []

    if (main.length > 0) {
      groups.push({ key: "MAIN", title: "Main Characters", items: main })
    }
    if (supporting.length > 0) {
      groups.push({
        key: "SUPPORTING",
        title: "Supporting Characters",
        items: supporting,
      })
    }
    if (background.length > 0) {
      groups.push({
        key: "BACKGROUND",
        title: "Background Characters",
        items: background,
      })
    }
    if (other.length > 0) {
      groups.push({
        key: "OTHER",
        title: "Other Characters",
        items: other,
      })
    }

    return groups
  }, [uniqueCharacters])

  return (
    <div className="flex flex-col gap-6">
      {/* Voice Language Filter */}
      {availableLanguages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="me-1 flex items-center gap-1 text-xs text-muted-foreground">
            <IconWorld className="size-3.5" aria-hidden="true" />
            <span>Voice:</span>
          </div>
          {availableLanguages.map((lang) => {
            const isActive = selectedLanguage === lang
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedLanguage(lang)}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium outline-none select-none ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                {lang}
              </button>
            )
          })}
        </div>
      )}

      {/* Characters Sections split by Role */}
      {groupedCharacters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No characters available for this title.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groupedCharacters.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`characters-role-${group.key}`}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <h3
                  id={`characters-role-${group.key}`}
                  className="text-sm font-semibold text-foreground"
                >
                  {group.title}
                </h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
                  {group.items.length}
                </span>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,140px)] gap-3 sm:gap-4">
                {group.items.map((char) => {
                  const currentActor =
                    char.actorsByLang.get(selectedLanguage) ??
                    (selectedLanguage === "All" ? char.defaultActor : null)

                  const roleUpper = char.role.toUpperCase()

                  return (
                    <div
                      key={char.characterId}
                      className="group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card hover:border-primary/40 transition-colors"
                    >
                      {/* Character Poster Image */}
                      <Link
                        href={`/borealis/characters/${char.characterId}`}
                        className="relative aspect-2/3 w-full overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                      >
                        {char.image ? (
                          <img
                            src={char.image}
                            alt={char.namePrimary}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                            <IconPhotoOff className="size-6" aria-hidden="true" />
                          </div>
                        )}

                        {/* Character Type Badge */}
                        <div className="absolute start-1.5 bottom-1.5 z-10 flex flex-wrap gap-1">
                          <Badge
                            variant={roleUpper === "MAIN" ? "default" : "secondary"}
                            className={cn(
                              "h-4 px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider backdrop-blur-md",
                              roleUpper === "MAIN"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : roleUpper === "SUPPORTING"
                                  ? "bg-black/80 text-white/90"
                                  : "bg-black/80 text-white/70"
                            )}
                          >
                            {roleUpper === "MAIN"
                              ? "Main"
                              : roleUpper === "SUPPORTING"
                                ? "Supporting"
                                : roleUpper === "BACKGROUND"
                                  ? "Background"
                                  : char.role}
                          </Badge>
                        </div>
                      </Link>

                      {/* Character Details Under Image */}
                      <div className="flex flex-1 flex-col gap-0.5 p-2">
                        <Link
                          href={`/borealis/characters/${char.characterId}`}
                          className="line-clamp-2 text-xs font-semibold text-foreground group-hover:underline"
                        >
                          {char.namePrimary}
                        </Link>
                        {char.nameNative && (
                          <span className="font-japanese truncate text-[10px] text-muted-foreground opacity-80">
                            {char.nameNative}
                          </span>
                        )}

                        {/* Voice Actor Underneath */}
                        {currentActor && (
                          <div className="mt-auto flex items-center gap-1.5 border-t border-border/40 pt-1.5 text-[10px]">
                            {currentActor.image ? (
                              <img
                                src={currentActor.image}
                                alt={currentActor.namePrimary}
                                loading="lazy"
                                className="size-4 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
                                VA
                              </div>
                            )}
                            <div className="flex min-w-0 flex-1 flex-col">
                              <Link
                                href={`/borealis/people/${currentActor.id}`}
                                className="truncate font-medium text-muted-foreground hover:text-foreground hover:underline"
                              >
                                {currentActor.namePrimary}
                              </Link>
                              {currentActor.language && (
                                <span className="text-[9px] text-muted-foreground/70">
                                  {currentActor.language}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
