#!/usr/bin/env bun
import { prisma } from "@IRIS/database"
import { c } from "../src/utils/colors.js"

const GENERIC_CHARACTER_NAMES = new Set([
  "doctor",
  "nurse",
  "police officer",
  "police",
  "cop",
  "detective",
  "guard",
  "security guard",
  "security",
  "waiter",
  "waitress",
  "bartender",
  "driver",
  "taxi driver",
  "cab driver",
  "reporter",
  "journalist",
  "anchor",
  "newscaster",
  "priest",
  "soldier",
  "pilot",
  "extra",
  "uncredited",
  "additional voices",
  "man",
  "woman",
  "boy",
  "girl",
  "student",
  "teacher",
  "officer",
  "lawyer",
  "judge",
  "agent",
  "fbi agent",
  "cia agent",
  "paramedic",
  "passenger",
  "pedestrian",
  "customer",
  "receptionist",
  "thug",
  "henchman",
  "prisoner",
  "inmate",
  "host",
  "guest",
  "announcer",
  "bystander",
  "crowd",
  "narrator",
  "himself",
  "herself",
  "themselves",
  "self",
])

function isGenericCharacterName(name: string): boolean {
  if (!name) return true
  const lower = name.trim().toLowerCase()
  if (GENERIC_CHARACTER_NAMES.has(lower)) return true
  if (/^(additional|adr\s+cast|uncredited|voice|background)/i.test(lower)) return true
  return false
}

function extractFranchisePrefix(title: string): string {
  if (!title) return ""
  let base = (title.split(/[:\-\/]/)[0] ?? "").trim()
  base = base.replace(/\s+(part\s+)?(\d+|[ivxlcdm]+)$/i, "").trim()
  return base
}

interface DisentangleResult {
  originalCharId: number
  charName: string
  retainedMedia: string
  retainedActor: string
  newCharId: number
  splitMedia: string
  splitActor: string
}

interface MergeResult {
  charName: string
  actorName: string
  canonicalId: number
  mergedIds: number[]
  appearances: {
    mediaTitle: string
    mediaId: number
    releaseYear?: number | null
    role: string
  }[]
}

async function main() {
  console.log(`\n${c.bold(c.cyan("================================================================"))}`)
  console.log(`${c.bold(c.cyan("  IRIS Character Deduplication & Disentanglement Migration"))}`)
  console.log(`${c.bold(c.cyan("================================================================\n"))}`)

  const disentangledReport: DisentangleResult[] = []
  const mergedReport: MergeResult[] = []

  // -------------------------------------------------------------------------
  // PHASE 1: Disentangle False Conflations (TVDB ID Collisions)
  // -------------------------------------------------------------------------
  console.log(`${c.bold(c.yellow("[Phase 1]"))} Checking and disentangling false conflations...`)

  // Characters with multiple media appearances across completely different franchises and different actors
  const multiMediaCharacters = await prisma.character.findMany({
    where: {
      mediaCharacters: {
        some: {
          movieId: { not: null },
        },
      },
    },
    include: {
      mediaCharacters: {
        include: {
          movie: true,
          tv: true,
          actor: true,
        },
      },
    },
  })

  for (const char of multiMediaCharacters) {
    if (char.mediaCharacters.length < 2) continue

    const isGeneric = isGenericCharacterName(char.namePrimary)

    // If generic character (e.g. "Himself", "Doctor", "Police Officer"), group by actorId:
    // Different actors playing a generic role should NEVER share the same Character record!
    if (isGeneric) {
      const actorGroups = new Map<number | null, typeof char.mediaCharacters>()
      for (const mc of char.mediaCharacters) {
        const key = mc.actorId
        if (!actorGroups.has(key)) {
          actorGroups.set(key, [])
        }
        actorGroups.get(key)!.push(mc)
      }

      if (actorGroups.size > 1) {
        const actorKeys = Array.from(actorGroups.keys())
        const primaryActorKey = actorKeys[0]!
        const otherActorKeys = actorKeys.slice(1)
        const primaryMcs = actorGroups.get(primaryActorKey)!
        const primaryTitle =
          primaryMcs[0]?.movie?.titlePrimary || primaryMcs[0]?.tv?.titlePrimary || "Media"
        const primaryActor = primaryMcs[0]?.actor?.namePrimary || "Unknown Actor"

        await prisma.character.update({
          where: { id: char.id },
          data: { tvDBId: null },
        })

        for (const actorKey of otherActorKeys) {
          const mcsToSplit = actorGroups.get(actorKey)!
          const splitTitle =
            mcsToSplit[0]?.movie?.titlePrimary || mcsToSplit[0]?.tv?.titlePrimary || "Media"
          const splitActor = mcsToSplit[0]?.actor?.namePrimary || "Unknown Actor"

          const newChar = await prisma.character.create({
            data: {
              namePrimary: char.namePrimary,
              image: mcsToSplit[0]?.actor?.image || mcsToSplit[0]?.movie?.coverImage || char.image || null,
              tvDBId: null,
            },
          })

          for (const mc of mcsToSplit) {
            await prisma.mediaCharacter.update({
              where: { id: mc.id },
              data: { characterId: newChar.id },
            })
          }

          disentangledReport.push({
            originalCharId: char.id,
            charName: `${char.namePrimary} (${primaryActor})`,
            retainedMedia: primaryTitle,
            retainedActor: primaryActor,
            newCharId: newChar.id,
            splitMedia: splitTitle,
            splitActor: splitActor,
          })
        }
        continue
      }
    }

    // Group media characters by franchise prefix
    const franchiseGroups = new Map<string, typeof char.mediaCharacters>()
    for (const mc of char.mediaCharacters) {
      const title = mc.movie?.titlePrimary || mc.tv?.titlePrimary || `Media_${mc.mediaId}`
      const franchise = extractFranchisePrefix(title).toLowerCase()
      if (!franchiseGroups.has(franchise)) {
        franchiseGroups.set(franchise, [])
      }
      franchiseGroups.get(franchise)!.push(mc)
    }

    // If there are multiple distinct franchises:
    if (franchiseGroups.size > 1) {
      const franchises = Array.from(franchiseGroups.keys())
      const isGeneric = isGenericCharacterName(char.namePrimary)

      // Check if actors differ across franchises
      const franchiseActors = new Map<string, Set<number | null>>()
      for (const [franchise, mcs] of franchiseGroups.entries()) {
        franchiseActors.set(franchise, new Set(mcs.map((m) => m.actorId)))
      }

      let shouldDisentangle = false
      // If actors differ between franchise 0 and franchise 1, or name is common/generic
      for (let i = 0; i < franchises.length; i++) {
        for (let j = i + 1; j < franchises.length; j++) {
          const f1 = franchises[i]!
          const f2 = franchises[j]!
          const actors1 = franchiseActors.get(f1)!
          const actors2 = franchiseActors.get(f2)!

          // Check if actors disjoint (or both null)
          const intersection = [...actors1].filter((x) => x !== null && actors2.has(x))
          if (intersection.length === 0 || isGeneric) {
            shouldDisentangle = true
            break
          }
        }
        if (shouldDisentangle) break
      }

      if (shouldDisentangle) {
        // Keep the first franchise on the original character
        const [primaryFranchise, ...otherFranchises] = franchises
        const primaryMcs = franchiseGroups.get(primaryFranchise!)!
        const primaryTitle =
          primaryMcs[0]?.movie?.titlePrimary || primaryMcs[0]?.tv?.titlePrimary || primaryFranchise!
        const primaryActor = primaryMcs[0]?.actor?.namePrimary || "Unknown"

        // Clear tvDBId on original character so it doesn't cause unique constraint collisions
        await prisma.character.update({
          where: { id: char.id },
          data: { tvDBId: null },
        })

        for (const franchise of otherFranchises) {
          const mcsToSplit = franchiseGroups.get(franchise)!
          const splitTitle =
            mcsToSplit[0]?.movie?.titlePrimary || mcsToSplit[0]?.tv?.titlePrimary || franchise
          const splitActor = mcsToSplit[0]?.actor?.namePrimary || "Unknown"

          // Create a new separate Character record for this distinct franchise appearance
          const newChar = await prisma.character.create({
            data: {
              namePrimary: char.namePrimary,
              image: mcsToSplit[0]?.movie?.coverImage || char.image || null,
              tvDBId: null,
            },
          })

          // Remap all mediaCharacters in this franchise to the new character
          for (const mc of mcsToSplit) {
            await prisma.mediaCharacter.update({
              where: { id: mc.id },
              data: { characterId: newChar.id },
            })
          }

          disentangledReport.push({
            originalCharId: char.id,
            charName: char.namePrimary,
            retainedMedia: primaryTitle,
            retainedActor: primaryActor,
            newCharId: newChar.id,
            splitMedia: splitTitle,
            splitActor: splitActor,
          })
        }
      }
    }
  }

  console.log(
    `${c.green("✔")} Phase 1 complete: ${disentangledReport.length} false conflation(s) disentangled.\n`
  )

  // -------------------------------------------------------------------------
  // PHASE 2: Merge True Duplicates (Sequels & Same Actors)
  // -------------------------------------------------------------------------
  console.log(`${c.bold(c.yellow("[Phase 2]"))} Discovering and merging true duplicate characters...`)

  // Reload all characters with their media characters
  const allCharacters = await prisma.character.findMany({
    include: {
      mediaCharacters: {
        include: {
          movie: true,
          tv: true,
          actor: true,
        },
      },
    },
    orderBy: { id: "asc" },
  })

  // Group candidates by normalized name: lowerCase name -> array of characters
  const nameGroups = new Map<string, typeof allCharacters>()
  for (const char of allCharacters) {
    const key = char.namePrimary.trim().toLowerCase()
    if (!nameGroups.has(key)) {
      nameGroups.set(key, [])
    }
    nameGroups.get(key)!.push(char)
  }

  const processedCharIds = new Set<number>()

  for (const [, candidates] of nameGroups.entries()) {
    if (candidates.length < 2) continue
    // Never merge generic character names across movies
    if (isGenericCharacterName(candidates[0]!.namePrimary)) continue

    // Within candidates of the same name, cluster true duplicates into duplicate sets
    const clusters: (typeof allCharacters)[] = []

    for (const cand of candidates) {
      if (processedCharIds.has(cand.id)) continue

      // Find if cand belongs to an existing cluster
      let matchedCluster: (typeof allCharacters) | null = null

      for (const cluster of clusters) {
        // Check if cand matches any member in cluster:
        const matches = cluster.some((member) => {
          // 1. Same actor match (non-null actorId in common)
          const memberActorIds = new Set(
            member.mediaCharacters.map((mc) => mc.actorId).filter((id): id is number => id !== null)
          )
          const candActorIds = new Set(
            cand.mediaCharacters.map((mc) => mc.actorId).filter((id): id is number => id !== null)
          )
          const sharedActor = [...memberActorIds].some((id) => candActorIds.has(id))
          if (sharedActor) return true

          // 2. Same franchise match (non-generic character in same franchise)
          if (!isGenericCharacterName(cand.namePrimary)) {
            const memberFranchises = new Set(
              member.mediaCharacters.map((mc) => {
                const title = mc.movie?.titlePrimary || mc.tv?.titlePrimary || ""
                return extractFranchisePrefix(title).toLowerCase()
              })
            )
            const candFranchises = new Set(
              cand.mediaCharacters.map((mc) => {
                const title = mc.movie?.titlePrimary || mc.tv?.titlePrimary || ""
                return extractFranchisePrefix(title).toLowerCase()
              })
            )
            const sharedFranchise = [...memberFranchises].some(
              (f) => f.length >= 3 && candFranchises.has(f)
            )
            if (sharedFranchise) return true
          }

          return false
        })

        if (matches) {
          matchedCluster = cluster
          break
        }
      }

      if (matchedCluster) {
        matchedCluster.push(cand)
      } else {
        clusters.push([cand])
      }
    }

    // Now for each cluster with > 1 character, merge them into the canonical record
    for (const cluster of clusters) {
      if (cluster.length < 2) continue

      // Select canonical character: smallest ID (earliest created) or one with AniList/MAL metadata
      cluster.sort((a, b) => {
        const aHasMeta = Boolean(a.anilistId || a.malId || a.description)
        const bHasMeta = Boolean(b.anilistId || b.malId || b.description)
        if (aHasMeta && !bHasMeta) return -1
        if (!aHasMeta && bHasMeta) return 1
        return a.id - b.id
      })

      const canonical = cluster[0]!
      const duplicates = cluster.slice(1)

      // Gather missing data from duplicates to canonical
      const missingImage = !canonical.image && duplicates.find((d) => d.image)?.image
      const missingDesc = !canonical.description && duplicates.find((d) => d.description)?.description

      if (missingImage || missingDesc || canonical.tvDBId) {
        await prisma.character.update({
          where: { id: canonical.id },
          data: {
            image: canonical.image || missingImage || null,
            description: canonical.description || missingDesc || null,
            tvDBId: null, // Clear credit ID
          },
        })
      }

      const mergedIds: number[] = []

      for (const dup of duplicates) {
        processedCharIds.add(dup.id)
        mergedIds.push(dup.id)

        // 1. Remap MediaCharacter rows
        const dupMcs = await prisma.mediaCharacter.findMany({
          where: { characterId: dup.id },
        })

        for (const mc of dupMcs) {
          // Check if canonical already has this exact appearance
          const existing = await prisma.mediaCharacter.findFirst({
            where: {
              mediaType: mc.mediaType,
              mediaId: mc.mediaId,
              characterId: canonical.id,
              actorId: mc.actorId,
            },
          })

          if (existing) {
            // Already present, delete redundant row
            await prisma.mediaCharacter.delete({ where: { id: mc.id } })
          } else {
            // Re-point to canonical
            await prisma.mediaCharacter.update({
              where: { id: mc.id },
              data: { characterId: canonical.id },
            })
          }
        }

        // 2. Remap Favorites
        const dupFavs = await prisma.favorite.findMany({
          where: { type: "CHARACTER", targetId: dup.id },
        })

        for (const fav of dupFavs) {
          const existingFav = await prisma.favorite.findFirst({
            where: { userId: fav.userId, type: "CHARACTER", targetId: canonical.id },
          })
          if (existingFav) {
            await prisma.favorite.delete({ where: { id: fav.id } })
          } else {
            await prisma.favorite.update({
              where: { id: fav.id },
              data: { targetId: canonical.id },
            })
          }
        }

        // 3. Delete duplicate Character row
        await prisma.character.delete({
          where: { id: dup.id },
        })
      }

      processedCharIds.add(canonical.id)

      // Gather appearances of canonical character
      const finalMcs = await prisma.mediaCharacter.findMany({
        where: { characterId: canonical.id },
        include: { movie: true, tv: true, actor: true },
      })

      const actorName =
        finalMcs.find((m) => m.actor?.namePrimary)?.actor?.namePrimary || "Uncredited / Unknown"

      mergedReport.push({
        charName: canonical.namePrimary,
        actorName,
        canonicalId: canonical.id,
        mergedIds,
        appearances: finalMcs.map((m) => ({
          mediaTitle: m.movie?.titlePrimary || m.tv?.titlePrimary || `Media #${m.mediaId}`,
          mediaId: m.mediaId,
          releaseYear: m.movie?.releaseDateYear || m.tv?.firstAiredYear,
          role: m.role,
        })),
      })
    }
  }

  console.log(`${c.green("✔")} Phase 2 complete: ${mergedReport.length} duplicate group(s) merged.\n`)

  // -------------------------------------------------------------------------
  // PHASE 3: Audit Report Output
  // -------------------------------------------------------------------------
  console.log(`${c.bold(c.cyan("================================================================"))}`)
  console.log(`${c.bold(c.cyan("                    MIGRATION AUDIT REPORT"))}`)
  console.log(`${c.bold(c.cyan("================================================================\n"))}`)

  if (disentangledReport.length > 0) {
    console.log(`${c.bold(c.magenta("▶ Disentangled False Conflations:"))}`)
    for (const item of disentangledReport) {
      console.log(`  • ${c.bold(item.charName)}:`)
      console.log(
        `    - Kept [Char #${item.originalCharId}] in ${c.yellow(`"${item.retainedMedia}"`)} (Actor: ${item.retainedActor})`
      )
      console.log(
        `    - Split into [Char #${item.newCharId}] for ${c.cyan(`"${item.splitMedia}"`)} (Actor: ${item.splitActor})\n`
      )
    }
  } else {
    console.log(`  No false conflations required disentanglement.`)
  }

  if (mergedReport.length > 0) {
    console.log(`${c.bold(c.green("▶ Merged Duplicate Characters Across Sequels:"))}`)
    for (const item of mergedReport) {
      console.log(`  • ${c.bold(c.white(item.charName))} (${c.dim(`Actor: ${item.actorName}`)})`)
      console.log(
        `    - Canonical ID: ${c.green(item.canonicalId)} | Merged IDs: ${c.yellow(item.mergedIds.join(", "))}`
      )
      console.log(`    - Appearances (${item.appearances.length} movies/shows):`)
      for (const app of item.appearances) {
        const yr = app.releaseYear ? ` (${app.releaseYear})` : ""
        console.log(`        * ${c.cyan(app.mediaTitle)}${yr} [Media #${app.mediaId}] - Role: ${app.role}`)
      }
      console.log("")
    }
  } else {
    console.log(`  No duplicate characters required merging.`)
  }

  const totalDupsRemoved = mergedReport.reduce((acc, m) => acc + m.mergedIds.length, 0)
  console.log(`${c.bold(c.cyan("================================================================"))}`)
  console.log(`${c.bold(c.green(`✔ Migration Successfully Completed!`))}`)
  console.log(`  - False Conflations Disentangled: ${disentangledReport.length}`)
  console.log(`  - Duplicate Characters Deleted:   ${totalDupsRemoved}`)
  console.log(`  - Canonical Groups Unified:       ${mergedReport.length}`)
  console.log(`${c.bold(c.cyan("================================================================\n"))}`)
}

main()
  .catch((err) => {
    console.error(c.red(c.bold("Migration failed with error:")), err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
