"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { IconPhotoOff, IconWorld } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { BorealisCard, BorealisCardGroup } from "@Runa/borealis"
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
        description?: string | null
        gender?: string | null
        age?: string | null
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
          description: item.description,
          gender: item.gender,
          age: item.age,
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
            <BorealisCardGroup
              key={group.key}
              title={group.title}
              subtitle={`${group.items.length} characters`}
              rowCount={1}
              dragFree
              variant="none"
            >
              {group.items.map((char) => {
                const currentActor =
                  char.actorsByLang.get(selectedLanguage) ??
                  (selectedLanguage === "All" ? char.defaultActor : null)

                return (
                  <BorealisCard
                    key={char.characterId}
                    type="character"
                    data={{
                      id: char.characterId,
                      characterId: char.characterId,
                      namePrimary: char.namePrimary,
                      nameNative: char.nameNative,
                      image: char.image,
                      role: char.role,
                      actor: currentActor,
                      description: char.description,
                      gender: char.gender,
                      age: char.age,
                    }}
                  />
                )
              })}
            </BorealisCardGroup>
          ))}
        </div>
      )}
    </div>
  )
}
