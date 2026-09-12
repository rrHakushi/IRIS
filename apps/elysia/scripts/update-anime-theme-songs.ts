#!/usr/bin/env bun
import { prisma } from "@IRIS/database"
import { c } from "../src/utils/colors.js"
import { deezerThemeResolver } from "../src/services/music/deezer-theme-resolver.service.js"
import type { EnrichedThemeSongItem } from "@IRIS/shared"

interface ThemeSongsStructure {
  op?: Array<EnrichedThemeSongItem | string> | null
  ed?: Array<EnrichedThemeSongItem | string> | null
}

function parseArgs() {
  const args = process.argv.slice(2).filter((a) => a !== "--")
  let id: number | null = null
  let all = false
  let dryRun = false
  let force = false
  let help = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--id" && args[i + 1]) {
      id = parseInt(args[i + 1]!, 10)
      i++
    } else if (arg === "--all") {
      all = true
    } else if (arg === "--dry-run") {
      dryRun = true
    } else if (arg === "--force") {
      force = true
    } else if (arg === "--help" || arg === "-h") {
      help = true
    }
  }

  // Default to processing all anime if no specific ID or help is requested
  if (!id && !all && !help) {
    all = true
  }

  return { id, all, dryRun, force, help }
}

async function main() {
  const { id, all, dryRun, force, help } = parseArgs()

  console.log(
    `\n${c.magenta(c.bold("=== IRIS Anime Theme Songs & Deezer Ingestion ==="))}\n`
  )

  if (help) {
    console.log(`${c.yellow("Usage:")}`)
    console.log(
      `  pnpm anime:theme-songs               # Updates all anime with theme songs`
    )
    console.log(
      `  pnpm anime:theme-songs --id <id>     # Updates a specific anime by ID`
    )
    console.log(`\n${c.yellow("Options:")}`)
    console.log(`  --dry-run   Preview matches without writing to database`)
    console.log(
      `  --force     Re-resolve even if already enriched with Deezer ID`
    )
    console.log(`  -h, --help  Show this help message`)
    console.log(`\nExample:`)
    console.log(`  pnpm anime:theme-songs --id 42\n`)
    process.exit(0)
  }

  const whereClause = id
    ? { id }
    : {
        themeSongs: { not: null as any },
      }

  const animes = await prisma.anime.findMany({
    where: whereClause,
    select: {
      id: true,
      titlePrimary: true,
      themeSongs: true,
    },
    orderBy: { id: "asc" },
  })

  if (animes.length === 0) {
    console.log(c.yellow(`No anime found matching criteria.`))
    process.exit(0)
  }

  console.log(
    `Found ${c.cyan(String(animes.length))} anime to process.${
      dryRun ? c.yellow(" (DRY RUN - No changes will be committed)") : ""
    }\n`
  )

  let totalSongs = 0
  let matchedDirect = 0
  let fallbacks = 0
  let updatedAnimes = 0

  for (let i = 0; i < animes.length; i++) {
    const anime = animes[i]!
    const rawThemeSongs = anime.themeSongs as ThemeSongsStructure | null

    if (
      !rawThemeSongs ||
      (!rawThemeSongs.op?.length && !rawThemeSongs.ed?.length)
    ) {
      continue
    }

    console.log(
      `\n[${i + 1}/${animes.length}] ${c.bold(anime.titlePrimary)} ${c.dim(`(ID: ${anime.id})`)}`
    )

    const updatedThemeSongs: ThemeSongsStructure = {
      op: [],
      ed: [],
    }

    let animeHasUpdates = false

    // Process Opening Themes
    if (rawThemeSongs.op && Array.isArray(rawThemeSongs.op)) {
      for (const item of rawThemeSongs.op) {
        totalSongs++
        const isAlreadyEnriched =
          typeof item === "object" && item !== null && item.deezerId && !force

        if (isAlreadyEnriched) {
          updatedThemeSongs.op!.push(item)
          matchedDirect++
          console.log(
            `  ${c.green("✓")} OP: ${c.dim(typeof item === "string" ? item : item.text)} ${c.cyan("(already enriched)")}`
          )
          continue
        }

        const resolved = await deezerThemeResolver.resolveThemeSong(item)
        updatedThemeSongs.op!.push(resolved)
        animeHasUpdates = true

        if (resolved.isDirectMatch) {
          matchedDirect++
          console.log(
            `  ${c.green("✓")} OP: "${c.bold(resolved.title || "")}" by ${resolved.artist} ` +
              `-> ${c.cyan(`Music ID: ${resolved.musicId}`)} | Deezer: ${c.blue(resolved.deezerUrl || "")}`
          )
        } else {
          fallbacks++
          console.log(
            `  ${c.yellow("~")} OP: "${resolved.title}" by ${resolved.artist} ` +
              `-> ${c.dim("No direct match, set search fallback:")} ${c.dim(resolved.deezerUrl || "")}`
          )
        }
      }
    }

    // Process Ending Themes
    if (rawThemeSongs.ed && Array.isArray(rawThemeSongs.ed)) {
      for (const item of rawThemeSongs.ed) {
        totalSongs++
        const isAlreadyEnriched =
          typeof item === "object" && item !== null && item.deezerId && !force

        if (isAlreadyEnriched) {
          updatedThemeSongs.ed!.push(item)
          matchedDirect++
          console.log(
            `  ${c.green("✓")} ED: ${c.dim(typeof item === "string" ? item : item.text)} ${c.cyan("(already enriched)")}`
          )
          continue
        }

        const resolved = await deezerThemeResolver.resolveThemeSong(item)
        updatedThemeSongs.ed!.push(resolved)
        animeHasUpdates = true

        if (resolved.isDirectMatch) {
          matchedDirect++
          console.log(
            `  ${c.green("✓")} ED: "${c.bold(resolved.title || "")}" by ${resolved.artist} ` +
              `-> ${c.cyan(`Music ID: ${resolved.musicId}`)} | Deezer: ${c.blue(resolved.deezerUrl || "")}`
          )
        } else {
          fallbacks++
          console.log(
            `  ${c.yellow("~")} ED: "${resolved.title}" by ${resolved.artist} ` +
              `-> ${c.dim("No direct match, set search fallback:")} ${c.dim(resolved.deezerUrl || "")}`
          )
        }
      }
    }

    // Write back to anime record if changes were made
    if (animeHasUpdates && !dryRun) {
      await prisma.anime.update({
        where: { id: anime.id },
        data: {
          themeSongs: updatedThemeSongs as any,
        },
      })
      updatedAnimes++
    }
  }

  console.log(`\n${c.magenta(c.bold("=== Theme Songs Update Complete ==="))}`)
  console.log(`Total Anime Processed:     ${c.bold(String(animes.length))}`)
  console.log(
    `Anime Records Updated:     ${c.green(c.bold(String(updatedAnimes)))}`
  )
  console.log(`Total Songs Scanned:       ${c.bold(String(totalSongs))}`)
  console.log(
    `Direct Deezer Matches:     ${c.green(c.bold(String(matchedDirect)))}`
  )
  console.log(
    `Search Fallbacks Set:      ${c.yellow(c.bold(String(fallbacks)))}\n`
  )

  process.exit(0)
}

main().catch((err) => {
  console.error(c.red(`Fatal error during update:`), err)
  process.exit(1)
})
