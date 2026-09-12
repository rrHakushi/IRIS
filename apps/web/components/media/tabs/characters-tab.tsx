"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { IconPhotoOff, IconWorld } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
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
    array.sort((a, b) => {
      if (a.role === "MAIN" && b.role !== "MAIN") return -1
      if (b.role === "MAIN" && a.role !== "MAIN") return 1
      return (a.order ?? 999) - (b.order ?? 999)
    })
    return array
  }, [characters])

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Language Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            All Characters ({uniqueCharacters.length})
          </h2>
        </div>

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
      </div>

      {/* Characters Grid */}
      {uniqueCharacters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No characters available for this title.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {uniqueCharacters.map((char) => {
            const currentActor =
              char.actorsByLang.get(selectedLanguage) ??
              (selectedLanguage === "All" ? char.defaultActor : null)

            return (
              <div
                key={char.characterId}
                className="flex items-center justify-between rounded-2xl border border-border/40 bg-card p-3"
              >
                {/* Character Side */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Link
                    href={`/IRIS-list/characters/${char.characterId}`}
                    className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {char.image ? (
                      <img
                        src={char.image}
                        alt={char.namePrimary}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                        <IconPhotoOff className="size-5" aria-hidden="true" />
                      </div>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-col">
                    <Link
                      href={`/IRIS-list/characters/${char.characterId}`}
                      className="truncate text-xs font-semibold text-foreground outline-none hover:underline focus-visible:underline"
                    >
                      {char.namePrimary}
                    </Link>
                    {char.nameNative && (
                      <span className="font-japanese truncate text-[10px] text-muted-foreground opacity-75">
                        {char.nameNative}
                      </span>
                    )}
                    <Badge
                      variant={char.role === "MAIN" ? "default" : "outline"}
                      className="mt-1 w-fit px-1.5 py-0 text-[9px] uppercase"
                    >
                      {char.role}
                    </Badge>
                  </div>
                </div>

                {/* Voice Actor Side */}
                <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 pl-2 text-end">
                  {currentActor ? (
                    <>
                      <div className="flex min-w-0 flex-col">
                        <Link
                          href={`/IRIS-list/people/${currentActor.id}`}
                          className="truncate text-xs font-medium text-foreground outline-none hover:underline focus-visible:underline"
                        >
                          {currentActor.namePrimary}
                        </Link>
                        {currentActor.language && (
                          <span className="text-[10px] text-muted-foreground">
                            {currentActor.language}
                          </span>
                        )}
                      </div>

                      <Link
                        href={`/IRIS-list/people/${currentActor.id}`}
                        className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {currentActor.image ? (
                          <img
                            src={currentActor.image}
                            alt={currentActor.namePrimary}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                            <IconPhotoOff
                              className="size-5"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </Link>
                    </>
                  ) : (
                    <span className="pr-1 text-[10px] text-muted-foreground/60 italic">
                      No {selectedLanguage} VA
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
