import type { TesseractDeviceType } from "./types"

const ADJECTIVES = [
  "Amber",
  "Azure",
  "Cobalt",
  "Crimson",
  "Emerald",
  "Lime",
  "Lunar",
  "Obsidian",
  "Prism",
  "Quartz",
  "Solar",
  "Velvet",
]

const NOUNS = [
  "Badger",
  "Comet",
  "Falcon",
  "Fox",
  "Hawk",
  "Lynx",
  "Orbit",
  "Otter",
  "Puffin",
  "Raven",
  "Spark",
  "Wolf",
]

export function detectDeviceMetadata(): {
  deviceType: TesseractDeviceType
  os: string
  browser: string
  defaultAlias: string
} {
  if (typeof navigator === "undefined") {
    return {
      deviceType: "desktop",
      os: "Unknown OS",
      browser: "Browser",
      defaultAlias: "Local Device",
    }
  }

  const ua = navigator.userAgent || ""
  const lower = ua.toLowerCase()

  let os = "Desktop"
  if (/iphone/.test(lower)) os = "iPhone"
  else if (/ipad/.test(lower) || (/macintosh/.test(lower) && navigator.maxTouchPoints > 1)) {
    os = "iPad"
  } else if (/android/.test(lower)) os = "Android"
  else if (/windows/.test(lower)) os = "Windows"
  else if (/mac os x|macintosh/.test(lower)) os = "macOS"
  else if (/cros/.test(lower)) os = "ChromeOS"
  else if (/linux/.test(lower)) os = "Linux"

  let browser = "Browser"
  if (/edg\//.test(lower)) browser = "Edge"
  else if (/opr\/|opera/.test(lower)) browser = "Opera"
  else if (/firefox\//.test(lower)) browser = "Firefox"
  else if (/chrome\/|crios\//.test(lower)) browser = "Chrome"
  else if (/safari\//.test(lower)) browser = "Safari"

  let deviceType: TesseractDeviceType = "desktop"
  if (os === "iPad" || (/android/.test(lower) && !/mobile/.test(lower))) {
    deviceType = "tablet"
  } else if (/iphone|android|mobile/.test(lower)) {
    deviceType = "mobile"
  }

  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!

  return {
    deviceType,
    os,
    browser,
    defaultAlias: `${adj} ${noun} · ${os}`,
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const val = bytes / 1024 ** exp
  return `${val >= 100 || exp === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[exp]}`
}

export function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "0 B/s"
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "--"
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.ceil(seconds % 60)
  return `${mins}m ${secs}s`
}

export function isLikelyUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback below for non-secure HTTP LAN contexts
    }
  }

  if (typeof document === "undefined") return false
  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    textarea.style.pointerEvents = "none"
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export interface DroppedFolderSpec {
  name: string
  files: Array<{ relativePath: string; file: File }>
}

async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = []
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (!batch || batch.length === 0) break
    entries.push(...batch)
  }
  return entries
}

async function traverseDirectoryEntry(
  dirEntry: FileSystemDirectoryEntry,
  prefix: string,
  out: Array<{ relativePath: string; file: File }>
): Promise<void> {
  const reader = dirEntry.createReader()
  const entries = await readAllDirectoryEntries(reader)

  for (const entry of entries) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject)
      })
      out.push({
        relativePath: `${prefix}/${entry.name}`,
        file,
      })
    } else if (entry.isDirectory) {
      await traverseDirectoryEntry(
        entry as FileSystemDirectoryEntry,
        `${prefix}/${entry.name}`,
        out
      )
    }
  }
}

export async function extractDroppedDataTransfer(
  dataTransfer: DataTransfer
): Promise<{
  files: File[]
  folders: DroppedFolderSpec[]
  text: string | null
}> {
  const items = Array.from(dataTransfer.items || [])
  const files: File[] = []
  const folders: DroppedFolderSpec[] = []

  const hasWebkitEntries = items.some(
    (item) =>
      item.kind === "file" &&
      typeof (item as any).webkitGetAsEntry === "function"
  )

  if (hasWebkitEntries) {
    const entryList = items
      .filter((i) => i.kind === "file")
      .map((i) => (i as any).webkitGetAsEntry?.() as FileSystemEntry | null)
      .filter((e): e is FileSystemEntry => e !== null)

    for (const entry of entryList) {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          ;(entry as FileSystemFileEntry).file(resolve, reject)
        })
        files.push(file)
      } else if (entry.isDirectory) {
        const collected: Array<{ relativePath: string; file: File }> = []
        await traverseDirectoryEntry(
          entry as FileSystemDirectoryEntry,
          entry.name,
          collected
        )
        folders.push({
          name: entry.name,
          files: collected,
        })
      }
    }
  } else {
    for (const file of Array.from(dataTransfer.files || [])) {
      files.push(file)
    }
  }

  let text: string | null = null
  if (files.length === 0 && folders.length === 0) {
    const plain = dataTransfer.getData("text/plain")
    if (plain && plain.trim().length > 0) {
      text = plain
    }
  }

  return { files, folders, text }
}

export function groupDirectoryInputFiles(
  fileList: FileList
): DroppedFolderSpec[] {
  const byRoot = new Map<string, Array<{ relativePath: string; file: File }>>()

  for (const file of Array.from(fileList)) {
    const rel = (file as any).webkitRelativePath || file.name
    const rootName = rel.split("/")[0] || "Folder"
    let list = byRoot.get(rootName)
    if (!list) {
      list = []
      byRoot.set(rootName, list)
    }
    list.push({
      relativePath: rel,
      file,
    })
  }

  return Array.from(byRoot.entries()).map(([name, files]) => ({
    name,
    files,
  }))
}

