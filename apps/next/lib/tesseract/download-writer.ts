import { Zip, ZipPassThrough } from "fflate"

export interface BinaryByteSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
}

export class UserCancelledSaveError extends Error {
  constructor() {
    super("Save location selection cancelled")
    this.name = "UserCancelledSaveError"
  }
}

export function supportsSaveFilePicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).showSaveFilePicker === "function"
  )
}

export function supportsDirectoryPicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).showDirectoryPicker === "function"
  )
}

export async function pickSaveFileHandle(
  suggestedName: string
): Promise<FileSystemFileHandle | null> {
  if (!supportsSaveFilePicker()) return null
  try {
    return await (window as any).showSaveFilePicker({
      suggestedName,
    })
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new UserCancelledSaveError()
    }
    // SecurityError (expired gesture) or unsupported origin falls back to OPFS/Blob download
    return null
  }
}

export async function pickTargetDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (!supportsDirectoryPicker()) return null
  try {
    return await (window as any).showDirectoryPicker({
      mode: "readwrite",
    })
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new UserCancelledSaveError()
    }
    return null
  }
}

function triggerBrowserBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  setTimeout(() => {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, 15_000)
}

export async function createSingleFileSink(options: {
  filename: string
  mimeType?: string
  preselectedHandle?: FileSystemFileHandle | null
}): Promise<BinaryByteSink> {
  if (options.preselectedHandle) {
    const writable = await options.preselectedHandle.createWritable()
    return {
      async write(chunk) {
        await writable.write(chunk as any)
      },
      async close() {
        await writable.close()
      },
      async abort() {
        await writable.abort()
      },
    }
  }

  // Tier 2: Origin Private File System (OPFS) so large downloads stay off JS heap
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.storage?.getDirectory === "function"
  ) {
    try {
      const root = await navigator.storage.getDirectory()
      const tempName = `tesseract-${crypto.randomUUID()}`
      const tempHandle = await root.getFileHandle(tempName, { create: true })
      const writable = await tempHandle.createWritable()
      return {
        async write(chunk) {
          await writable.write(chunk as any)
        },
        async close() {
          await writable.close()
          const file = await tempHandle.getFile()
          const typedBlob = options.mimeType
            ? file.slice(0, file.size, options.mimeType)
            : file
          triggerBrowserBlobDownload(typedBlob, options.filename)
          setTimeout(() => {
            root.removeEntry(tempName).catch(() => {})
          }, 30_000)
        },
        async abort() {
          try {
            await writable.abort()
          } catch {}
          await root.removeEntry(tempName).catch(() => {})
        },
      }
    } catch {
      // OPFS unavailable (e.g. non-secure HTTP LAN context); fall through to Blob chunks
    }
  }

  // Tier 3: In-memory BlobPart[] fallback (works on plain http://192.168.x.x)
  const chunks: Uint8Array[] = []
  return {
    async write(chunk) {
      chunks.push(chunk)
    },
    async close() {
      const blob = new Blob(chunks as BlobPart[], {
        type: options.mimeType || "application/octet-stream",
      })
      chunks.length = 0
      triggerBrowserBlobDownload(blob, options.filename)
    },
    async abort() {
      chunks.length = 0
    },
  }
}

export interface MultiFileReceiverSink {
  beginFile(relativePath: string, mimeType: string): Promise<void>
  writeChunk(chunk: Uint8Array): Promise<void>
  endFile(): Promise<void>
  finish(): Promise<void>
  abort(): Promise<void>
}

export async function createStreamingZipSink(options: {
  zipFilename: string
  preselectedHandle?: FileSystemFileHandle | null
}): Promise<MultiFileReceiverSink> {
  const byteSink = await createSingleFileSink({
    filename: options.zipFilename,
    mimeType: "application/zip",
    preselectedHandle: options.preselectedHandle,
  })

  let writeChain = Promise.resolve()
  let currentEntry: ZipPassThrough | null = null
  let streamFailed: Error | null = null

  const zip = new Zip((err, data) => {
    if (err) {
      streamFailed = err
      return
    }
    if (data && data.length > 0) {
      const copy = data.slice()
      writeChain = writeChain.then(() => byteSink.write(copy))
    }
  })

  return {
    async beginFile(relativePath: string) {
      if (streamFailed) throw streamFailed
      const sanitized = relativePath.replace(/^\/+/, "") || "file"
      const entry = new ZipPassThrough(sanitized)
      currentEntry = entry
      zip.add(entry)
    },
    async writeChunk(chunk: Uint8Array) {
      if (streamFailed) throw streamFailed
      if (!currentEntry) return
      currentEntry.push(chunk, false)
      await writeChain
    },
    async endFile() {
      if (currentEntry) {
        currentEntry.push(new Uint8Array(0), true)
        currentEntry = null
        await writeChain
      }
    },
    async finish() {
      if (currentEntry) {
        currentEntry.push(new Uint8Array(0), true)
        currentEntry = null
      }
      zip.end()
      await writeChain
      await byteSink.close()
    },
    async abort() {
      currentEntry = null
      await byteSink.abort()
    },
  }
}

export async function createDirectoryWriterSink(
  rootDirHandle: FileSystemDirectoryHandle
): Promise<MultiFileReceiverSink> {
  let activeWritable: FileSystemWritableFileStream | null = null

  const resolveNestedFile = async (relativePath: string) => {
    const parts = relativePath
      .split("/")
      .map((p) => p.trim())
      .filter((p) => p && p !== "." && p !== "..")

    const fileName = parts.pop() || "unnamed-file"
    let currentDir = rootDirHandle
    for (const folderName of parts) {
      currentDir = await currentDir.getDirectoryHandle(folderName, {
        create: true,
      })
    }
    return await currentDir.getFileHandle(fileName, { create: true })
  }

  return {
    async beginFile(relativePath: string) {
      const handle = await resolveNestedFile(relativePath)
      activeWritable = await handle.createWritable()
    },
    async writeChunk(chunk: Uint8Array) {
      if (!activeWritable) return
      await activeWritable.write(chunk as any)
    },
    async endFile() {
      if (activeWritable) {
        await activeWritable.close()
        activeWritable = null
      }
    },
    async finish() {
      if (activeWritable) {
        await activeWritable.close()
        activeWritable = null
      }
    },
    async abort() {
      if (activeWritable) {
        try {
          await activeWritable.abort()
        } catch {}
        activeWritable = null
      }
    },
  }
}

