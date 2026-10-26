import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Ensures monorepo root `.env` is loaded into `Bun.env` if not already present.
 * Bun natively supports `--env-file=../../.env`, but this programmatic fallback
 * guarantees environment variables are present even when invoked without CLI flags.
 */
export function ensureEnvLoaded() {
  if (Bun.env.JWT_SECRET) return

  const candidatePaths = [
    resolve(import.meta.dir, '../../../.env'),
    resolve(import.meta.dir, '../../.env'),
    resolve(process.cwd(), '../.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ]

  for (const envPath of candidatePaths) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf8')
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx === -1) continue
          const key = trimmed.slice(0, eqIdx).trim()
          let val = trimmed.slice(eqIdx + 1).trim()
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          // Simple variable interpolation like ${ELYSIA_PORT}
          val = val.replace(/\$\{([^}]+)\}/g, (_, varName) => Bun.env[varName] ?? '')
          if (!Bun.env[key]) {
            Bun.env[key] = val
          }
        }
        return
      } catch {}
    }
  }
}

ensureEnvLoaded()
