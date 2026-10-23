#!/usr/bin/env bun
/**
 * Script to update character and media descriptions so we don't have to rely on /IRIS-list redirect.
 * Replaces legacy '/IRIS-list' URLs in descriptions with canonical '/borealis' URLs.
 *
 * Usage:
 *   bun scripts/update-description-urls.ts
 *   bun scripts/update-description-urls.ts --dry-run
 */

import '../apps/elysia/src/load-env'
import { prisma } from '@Iris/db'

const isDryRun = process.argv.includes('--dry-run')

interface ModelConfig {
  name: string
  model: any
}

const MODELS: ModelConfig[] = [
  { name: 'Character', model: prisma.orm.public.Character },
  { name: 'Person', model: prisma.orm.public.Person },
  { name: 'Anime', model: prisma.orm.public.Anime },
  { name: 'Manga', model: prisma.orm.public.Manga },
  { name: 'Tv', model: prisma.orm.public.Tv },
  { name: 'Movie', model: prisma.orm.public.Movie },
  { name: 'Book', model: prisma.orm.public.Book },
  { name: 'Game', model: prisma.orm.public.Game },
  { name: 'Music', model: prisma.orm.public.Music },
  { name: 'AnimeEpisode', model: prisma.orm.public.AnimeEpisode },
  { name: 'TvSeason', model: prisma.orm.public.TvSeason },
  { name: 'TvEpisode', model: prisma.orm.public.TvEpisode },
]

// Replaces /IRIS-list or /iris-list in URLs with /borealis
const URL_REGEX = /\/iris-list(?=[\/?#\s"'<)\].]|$)/gi

async function processModel(config: ModelConfig): Promise<number> {
  const { name, model } = config

  const records = await model
    .where((row: any) => row.description.ilike('%iris-list%'))
    .all()

  if (records.length === 0) {
    return 0
  }

  console.log(`\n📦 Processing ${records.length} records in ${name}...`)

  let updatedCount = 0

  for (const item of records) {
    if (!item.description || !URL_REGEX.test(item.description)) {
      continue
    }

    const newDescription = item.description.replace(URL_REGEX, '/borealis')

    if (newDescription !== item.description) {
      if (!isDryRun) {
        await model
          .where((row: any) => row.id.eq(item.id))
          .update({ description: newDescription })
      }
      updatedCount++
    }
  }

  console.log(
    `  ${isDryRun ? '[DRY RUN] Would update' : '✓ Updated'} ${updatedCount} ${name} records.`
  )
  return updatedCount
}

async function main() {
  console.log('='.repeat(60))
  console.log(
    `🔄 IRIS Description URL Migration (/IRIS-list -> /borealis)${isDryRun ? ' [DRY RUN]' : ''}`
  )
  console.log('='.repeat(60))

  let totalUpdated = 0

  for (const config of MODELS) {
    try {
      const count = await processModel(config)
      totalUpdated += count
    } catch (err: any) {
      console.error(`❌ Error processing ${config.name}:`, err.message || err)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(
    `🎉 Finished! Total ${isDryRun ? 'records to update' : 'records updated'}: ${totalUpdated}`
  )
  console.log('='.repeat(60))
}

main()
  .catch((err) => {
    console.error('Fatal script error:', err)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
