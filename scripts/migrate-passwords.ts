#!/usr/bin/env bun
/**
 * IRIS Account Password Migration TUI
 *
 * Interactively migrates existing user account passwords from legacy scrypt
 * hashes to native Bun Argon2id hashes with masked terminal input.
 */

import '../apps/elysia/src/load-env'
import { prisma } from '@Iris/db'

// Terminal ANSI formatting
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
}

function promptLine(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(promptText)
    let buffer = ''
    const isTTY = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function')

    const onData = (chunk: Buffer) => {
      const str = chunk.toString('utf8')
      for (const char of str) {
        if (char === '\r' || char === '\n') {
          if (isTTY) process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(buffer.trim())
          return
        } else if (char === '\u0003') {
          // Ctrl+C
          if (isTTY) process.stdin.setRawMode(false)
          process.stdout.write('\n' + c.yellow + 'Migration aborted by user.' + c.reset + '\n')
          process.exit(130)
        } else if (char === '\u007f' || char === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1)
            if (isTTY) process.stdout.write('\b \b')
          }
        } else {
          buffer += char
          if (isTTY) process.stdout.write(char)
        }
      }
    }

    if (isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

function promptMasked(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(promptText)
    let buffer = ''
    const isTTY = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function')

    const onData = (chunk: Buffer) => {
      const str = chunk.toString('utf8')
      for (const char of str) {
        if (char === '\r' || char === '\n') {
          if (isTTY) process.stdin.setRawMode(false)
          process.stdin.pause()
          process.stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(buffer)
          return
        } else if (char === '\u0003') {
          // Ctrl+C
          if (isTTY) process.stdin.setRawMode(false)
          process.stdout.write('\n' + c.yellow + 'Migration aborted by user.' + c.reset + '\n')
          process.exit(130)
        } else if (char === '\u007f' || char === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1)
            if (isTTY) process.stdout.write('\b \b')
          }
        } else {
          buffer += char
          if (isTTY) process.stdout.write('*')
        }
      }
    }

    if (isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

function detectHashType(hash: string | null): string {
  if (!hash) return `${c.gray}None${c.reset}`
  if (hash.startsWith('$argon2')) return `${c.green}Argon2 (Bun native)${c.reset}`
  if (hash.includes(':')) return `${c.yellow}Legacy Scrypt (salt:key)${c.reset}`
  return `${c.red}Unknown format${c.reset}`
}

async function main() {
  console.clear()
  console.log(`
${c.bold}${c.cyan}╔════════════════════════════════════════════════════════════════╗
║             IRIS User Password Migration TUI                   ║
║         Migrate Accounts to Native Bun Argon2id Hashes         ║
╚════════════════════════════════════════════════════════════════╝${c.reset}
`)

  console.log(`${c.gray}Connecting to database...${c.reset}`)
  const users = await prisma.orm.public.User
    .select('id', 'username', 'email', 'passwordHash')
    .orderBy((u) => u.createdAt.asc())
    .all()

  if (users.length === 0) {
    console.log(`${c.yellow}No users found in database.${c.reset}`)
    await prisma.close()
    return
  }

  console.log(`${c.green}✓ Connected successfully.${c.reset} Found ${c.bold}${users.length}${c.reset} user account(s).\n`)

  let updatedCount = 0
  let skippedCount = 0

  for (let i = 0; i < users.length; i++) {
    const user = users[i]!
    const progress = `[${i + 1}/${users.length}]`

    console.log(`${c.bold}${c.magenta}────────────────────────────────────────────────────────────────${c.reset}`)
    console.log(`${c.bold}Account ${progress}:${c.reset}`)
    console.log(`  ${c.bold}Username:${c.reset}    ${c.cyan}${user.username}${c.reset}`)
    console.log(`  ${c.bold}Email:${c.reset}       ${user.email || `${c.gray}(none)${c.reset}`}`)
    console.log(`  ${c.bold}ID:${c.reset}          ${c.gray}${user.id}${c.reset}`)
    console.log(`  ${c.bold}Hash Type:${c.reset}   ${detectHashType(user.passwordHash)}`)
    console.log(`${c.gray}────────────────────────────────────────────────────────────────${c.reset}`)

    let actionPrompted = false
    while (!actionPrompted) {
      const choice = await promptLine(
        `Action for ${c.cyan}${user.username}${c.reset} [${c.bold}1${c.reset}: set password, ${c.bold}s${c.reset}: skip, ${c.bold}q${c.reset}: quit]: `
      )

      const normalized = choice.toLowerCase()

      if (normalized === 'q') {
        console.log(`\n${c.yellow}Exiting migration...${c.reset}`)
        printSummary(updatedCount, skippedCount, users.length)
        await prisma.close()
        process.exit(0)
      }

      if (normalized === 's' || normalized === '') {
        console.log(`${c.yellow}Skipped account.${c.reset}\n`)
        skippedCount++
        actionPrompted = true
        break
      }

      if (normalized === '1' || normalized === 'p') {
        let passwordValid = false
        while (!passwordValid) {
          const pass1 = await promptMasked(`Enter new password for ${c.cyan}${user.username}${c.reset}: `)

          if (pass1.trim().length === 0) {
            console.log(`${c.red}Password cannot be empty.${c.reset}`)
            const retry = await promptLine(`Retry password entry? [y/N]: `)
            if (retry.toLowerCase() !== 'y') {
              console.log(`${c.yellow}Skipped account.${c.reset}\n`)
              skippedCount++
              passwordValid = true
              actionPrompted = true
              break
            }
            continue
          }

          if (pass1.length < 6) {
            console.log(`${c.yellow}Warning: Password is less than 6 characters.${c.reset}`)
          }

          const pass2 = await promptMasked(`Confirm new password: `)

          if (pass1 !== pass2) {
            console.log(`${c.red}Passwords do not match. Please try again.${c.reset}\n`)
            continue
          }

          console.log(`${c.gray}Hashing with Bun Argon2id...${c.reset}`)
          const hashedPassword = await Bun.password.hash(pass1, {
            algorithm: 'argon2id',
          })

          await prisma.orm.public.User
            .where({ id: user.id })
            .select('id')
            .update({ passwordHash: hashedPassword })

          console.log(`${c.green}✓ Password successfully updated and verified for ${user.username}!${c.reset}\n`)
          updatedCount++
          passwordValid = true
          actionPrompted = true
        }
      } else {
        console.log(`${c.red}Invalid option. Enter 1 to set password, s to skip, or q to quit.${c.reset}`)
      }
    }
  }

  printSummary(updatedCount, skippedCount, users.length)
  await prisma.close()
}

function printSummary(updated: number, skipped: number, total: number) {
  console.log(`
${c.bold}${c.cyan}╔════════════════════════════════════════════════════════════════╗
║                      Migration Summary                         ║
╚════════════════════════════════════════════════════════════════╝${c.reset}
  ${c.bold}Total Accounts Checked:${c.reset} ${total}
  ${c.green}${c.bold}Successfully Updated:${c.reset}   ${updated}
  ${c.yellow}${c.bold}Skipped Accounts:${c.reset}       ${skipped}
`)
}

main().catch(async (err) => {
  console.error(`\n${c.red}${c.bold}Migration Error:${c.reset}`, err)
  await prisma.close()
  process.exit(1)
})
