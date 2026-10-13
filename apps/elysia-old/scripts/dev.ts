#!/usr/bin/env bun
import fs from "node:fs"
import path from "node:path"
import { spawn, type ChildProcess } from "node:child_process"
import { generateRoutes } from "../src/router/generator"
import { generateInsomniumConfig } from "../src/router/insomnium"
import { c } from "../src/utils/colors"

const MODULES_DIR = path.resolve(import.meta.dirname, "../src/modules")
const INDEX_FILE = path.resolve(import.meta.dirname, "../src/index.ts")

/**
 * Resilient development server runner for the IRIS Elysia backend.
 *
 * Solves the missing-import crash problem when route files are deleted manually
 * through the file system:
 * 1. Synchronously validates and generates route manifests before server startup.
 * 2. Runs an independent filesystem watcher in the parent process outside Bun's runtime.
 * 3. Immediately regenerates manifests on any file addition, rename, or deletion.
 * 4. Spawns `bun --watch src/index.ts` as a managed child process.
 *
 * @example
 * ```bash
 * bun scripts/dev.ts
 * ```
 */
export async function main(): Promise<void> {
  console.log(
    `${c.blue(c.bold("[Dev Runner]"))} ${c.dim("Initializing resilient file watcher and route manifests...")}`
  )

  // 1. Initial pre-flight generation before server boots
  try {
    await generateRoutes({ modulesDir: MODULES_DIR, silent: true })
    await generateInsomniumConfig({ modulesDir: MODULES_DIR, silent: true })
    console.log(
      `${c.green(c.bold("✔"))} ${c.dim("Initial route manifests synchronized.")}`
    )
  } catch (err) {
    console.error(
      `${c.red(c.bold("[Dev Runner] Initial manifest generation failed:"))}`,
      err
    )
  }

  // 2. Setup independent watcher on src/modules
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let isRegenerating = false

  const watcher = fs.watch(
    MODULES_DIR,
    { recursive: true },
    (_eventType, filename) => {
      if (!filename) return
      const ext = path.extname(filename)
      if (![".ts", ".js"].includes(ext)) return

      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        if (isRegenerating) return
        isRegenerating = true
        try {
          await generateRoutes({ modulesDir: MODULES_DIR, silent: true })
          await generateInsomniumConfig({ modulesDir: MODULES_DIR, silent: true })
        } catch (err) {
          console.error(
            `${c.red(c.bold("[Dev Runner] Auto-manifest update failed:"))}`,
            err
          )
        } finally {
          isRegenerating = false
        }
      }, 100)
    }
  )

  // 3. Spawn child server with Bun watch
  let serverProcess: ChildProcess | null = null

  function startServer() {
    serverProcess = spawn(
      "bun",
      ["--no-warnings", "--watch", INDEX_FILE],
      {
        stdio: "inherit",
        env: process.env,
      }
    )

    serverProcess.on("close", (code) => {
      if (code !== 0 && code !== null) {
        console.log(
          `${c.yellow("[Dev Runner]")} Server exited with code ${code}. Waiting for file changes...`
        )
      }
    })
  }

  startServer()

  // 4. Handle clean shutdown
  const shutdown = () => {
    try {
      watcher.close()
    } catch {
      // ignore
    }
    if (serverProcess) {
      serverProcess.kill("SIGINT")
    }
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

if (import.meta.main) {
  main()
}
