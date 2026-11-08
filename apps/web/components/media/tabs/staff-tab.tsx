"use client"

import React, { useMemo } from "react"
import Link from "next/link"
import { IconPhotoOff } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { BorealisCard, BorealisCardGroup } from "@Runa/borealis"
import type { StaffMemberItem } from "../media-types"

interface StaffTabProps {
  staff: StaffMemberItem[]
}

const ROLE_PRIORITY_ORDER: Array<{ match: RegExp; priority: number }> = [
  // 1. Creators / Authors
  { match: /original (creator|story|work)|author|creator|manga/i, priority: 1 },
  // 2. Directors
  { match: /^director$|chief director|series director/i, priority: 2 },
  // 3. Writers / Composition
  { match: /writer|screenplay|script|series composition|story/i, priority: 3 },
  // 4. Character Design
  { match: /character design/i, priority: 4 },
  // 5. Animation Directors
  { match: /animation director/i, priority: 5 },
  // 6. Art Directors / Production Design
  { match: /art director|production design/i, priority: 6 },
  // 7. Music / Composer
  { match: /music|composer|soundtrack/i, priority: 7 },
  // 8. Sound Director
  { match: /sound/i, priority: 8 },
  // 9. Cinematography / Photography
  { match: /cinematography|photography/i, priority: 9 },
  // 10. Editing
  { match: /editor|editing/i, priority: 10 },
  // 11. Producer
  { match: /^producer$/i, priority: 11 },
  // 12. Executive Producer
  { match: /executive producer/i, priority: 12 },
  // 13. Other Production (Associate Producer, Line Producer, etc.)
  { match: /producer/i, priority: 13 },
  // 14. Key Animation / Animators
  { match: /animat/i, priority: 14 },
  // 15. Episode Directors
  { match: /episode/i, priority: 15 },
  // 16. Casting
  { match: /casting/i, priority: 16 },
  // 17. Costumes / Makeup / Color
  { match: /costume|color|makeup/i, priority: 17 },
  // 18. Artists / Performers / Lyricists
  { match: /theme song|artist|lyric|arrang|singer|vocal/i, priority: 18 },
  // 19. Cast (if present in staff)
  { match: /^cast$/i, priority: 19 },
]

function getRolePriority(roleTitle: string): number {
  if (/other/i.test(roleTitle)) return 99
  for (const rule of ROLE_PRIORITY_ORDER) {
    if (rule.match.test(roleTitle)) {
      return rule.priority
    }
  }
  return 50 // default middle priority for unlisted specific roles
}

const ROLE_LABELS: Record<string, string> = {
  ORIGINAL_CREATOR: "Original Creator",
  AUTHOR: "Author",
  ILLUSTRATOR: "Illustrator",
  DIRECTOR: "Director",
  SCRIPT: "Script",
  CHARACTER_DESIGN: "Character Design",
  CHIEF_ANIMATION_DIRECTOR: "Chief Animation Director",
  ART_DIRECTOR: "Art Director",
  COMPOSER: "Music / Composer",
  SOUND_DIRECTOR: "Sound Director",
  PRODUCER: "Producer",
  EXECUTIVE_PRODUCER: "Executive Producer",
  COLOR_DESIGN: "Color Design",
  KEY_ANIMATION: "Key Animation",
  EPISODE_DIRECTOR: "Episode Director",
  CAST: "Cast",
  ARTIST: "Artist",
  FEATURED_ARTIST: "Featured Artist",
  LYRICIST: "Lyricist",
  ARRANGER: "Arranger",
  OTHER: "Other Staff",
}

function cleanRoleForGrouping(rawRole: string): string {
  // Strip parentheses and brackets and their contents, e.g. "Script (eps 1-5, 7-11)" -> "Script"
  const stripped = rawRole
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*\[[^\]]*\]/g, "")
    .trim()
  return stripped || rawRole
}

function normalizeRole(str: string): string {
  if (!str) return "Staff"
  return str
    .replace(/_/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase() && !/^[A-Z]$/.test(word)) {
        return word
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(" ")
}

function getStaffRoleTitle(member: StaffMemberItem): string {
  const custom = member.customRole?.trim()
  if (custom) {
    const cleaned = cleanRoleForGrouping(custom)
    return normalizeRole(cleaned)
  }

  const role = (member.role || "Staff").trim()
  const cleanedRole = cleanRoleForGrouping(role)
  const normalizedKey = cleanedRole.toUpperCase()
  if (ROLE_LABELS[normalizedKey]) {
    return ROLE_LABELS[normalizedKey]
  }

  return normalizeRole(cleanedRole)
}

export function StaffTab({ staff }: StaffTabProps) {
  // Group staff members by their effective role (customRole prioritized over role enum)
  const groupedStaff = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        title: string
        priority: number
        items: StaffMemberItem[]
      }
    >()

    for (const member of staff) {
      const title = getStaffRoleTitle(member)
      const key = title.toLowerCase()

      const existing = map.get(key)
      if (existing) {
        existing.items.push(member)
      } else {
        map.set(key, {
          key,
          title,
          priority: getRolePriority(title),
          items: [member],
        })
      }
    }

    const groups = Array.from(map.values())

    groups.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      return a.title.localeCompare(b.title)
    })

    return groups
  }, [staff])

  if (staff.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No staff information available for this title.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {groupedStaff.map((group) => (
        <BorealisCardGroup
          key={group.key}
          title={group.title}
          subtitle={`${group.items.length} staff members`}
          rowCount={1}
          dragFree
          variant="none"
        >
          {group.items.map((member) => (
            <BorealisCard
              key={member.id}
              type="staff"
              data={{
                id: member.person.id,
                personId: member.person.id,
                namePrimary: member.person.namePrimary,
                nameNative: member.person.nameNative,
                image: member.person.image,
                role: member.customRole || getStaffRoleTitle(member),
              }}
            />
          ))}
        </BorealisCardGroup>
      ))}
    </div>
    )
  }
