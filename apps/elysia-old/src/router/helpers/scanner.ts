import fs from "node:fs"
import path from "node:path"

/**
 * Recursively scans a filesystem directory for all `route.ts` or `route.js` files.
 *
 * Automatically excludes:
 * - Hidden files and directories (starting with `.`)
 * - Editor temporary files, backups, and copies (e.g. `*.bak`, `*.tmp`, `* copy`, `*(1)`)
 *
 * @param dir - Starting directory path to traverse
 * @param baseDir - Base reference directory (defaults to starting directory)
 * @returns Array of absolute file paths matching valid route files
 *
 * @example
 * ```typescript
 * const routes = findRouteFiles(path.resolve("src/modules"))
 * ```
 */
export function findRouteFiles(dir: string, baseDir: string = dir): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  const results: string[] = []
  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    const name = entry.name

    // Ignore hidden files and directories (except RFC 5785 .well-known)
    if (name.startsWith(".") && name !== ".well-known") continue

    // Ignore temporary, backup, or editor duplicate copies (e.g. 'refresh copy', 'folder (1)', '*.bak')
    if (
      /\s+copy(\s+\d+)?$/i.test(name) ||
      /\s*\(\d+\)$/.test(name) ||
      /\s*\(copy\)/i.test(name)
    ) {
      continue
    }
    if (/\.bak$|\.tmp$|\.old$|~$/i.test(name)) continue

    const fullPath = path.join(dir, name)
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath, baseDir))
    } else if (entry.isFile() && (name === "route.ts" || name === "route.js")) {
      results.push(fullPath)
    }
  }

  return results
}
