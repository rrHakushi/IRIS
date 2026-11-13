import { describe, expect, test } from "bun:test"
import { unzipSync, Zip, ZipPassThrough } from "fflate"
import {
  extractDroppedDataTransfer,
  formatBytes,
  formatEta,
  formatSpeed,
  groupDirectoryInputFiles,
  isLikelyUrl,
} from "./device-info"
import { buildTransferItemMetaList } from "./webrtc-mesh"

describe("Tesseract Client Utilities", () => {
  test("formats byte sizes, transfer speeds, and ETAs", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB")

    expect(formatSpeed(0)).toBe("0 B/s")
    expect(formatSpeed(2 * 1024 * 1024)).toBe("2.0 MB/s")

    expect(formatEta(null)).toBe("--")
    expect(formatEta(-1)).toBe("--")
    expect(formatEta(12)).toBe("12s")
    expect(formatEta(125)).toBe("2m 5s")
  })

  test("identifies http/https URLs accurately", () => {
    expect(isLikelyUrl("https://local.example/file?a=1")).toBe(true)
    expect(isLikelyUrl("http://192.168.1.10:3000/tesseract")).toBe(true)
    expect(isLikelyUrl("ftp://192.168.1.10/file")).toBe(false)
    expect(isLikelyUrl("hello world")).toBe(false)
    expect(isLikelyUrl("https://example.com has spaces")).toBe(false)
  })

  test("groups FileList directory uploads by root folder while preserving relative paths", () => {
    const fileA = new File(["alpha"], "a.txt", { type: "text/plain" })
    Object.defineProperty(fileA, "webkitRelativePath", {
      value: "Photos/2026/a.txt",
    })
    const fileB = new File(["beta"], "b.png", { type: "image/png" })
    Object.defineProperty(fileB, "webkitRelativePath", {
      value: "Photos/b.png",
    })
    const fileC = new File(["empty"], ".gitkeep", { type: "text/plain" })
    Object.defineProperty(fileC, "webkitRelativePath", {
      value: "Docs/.gitkeep",
    })

    const fakeFileList = {
      0: fileA,
      1: fileB,
      2: fileC,
      length: 3,
      item: (idx: number) => [fileA, fileB, fileC][idx] ?? null,
      [Symbol.iterator]: function* () {
        yield fileA
        yield fileB
        yield fileC
      },
    } as unknown as FileList

    const grouped = groupDirectoryInputFiles(fakeFileList)
    expect(grouped.length).toBe(2)
    expect(grouped[0]!.name).toBe("Photos")
    expect(grouped[0]!.files.map((f) => f.relativePath)).toEqual([
      "Photos/2026/a.txt",
      "Photos/b.png",
    ])
    expect(grouped[1]!.name).toBe("Docs")
    expect(grouped[1]!.files[0]!.relativePath).toBe("Docs/.gitkeep")
  })

  test("extractDroppedDataTransfer reads plain text when no files are dropped", async () => {
    const dt = {
      items: [],
      files: [],
      getData: (type: string) =>
        type === "text/plain" ? "http://192.168.1.50:3000" : "",
    } as unknown as DataTransfer

    const res = await extractDroppedDataTransfer(dt)
    expect(res.files.length).toBe(0)
    expect(res.folders.length).toBe(0)
    expect(res.text).toBe("http://192.168.1.50:3000")
  })

  test("builds transfer metadata for files, folders, and text snippets", () => {
    const meta = buildTransferItemMetaList([
      {
        id: "f1",
        kind: "file",
        name: "report.pdf",
        size: 1024,
        mimeType: "application/pdf",
      },
      {
        id: "d1",
        kind: "folder",
        name: "Assets",
        totalSize: 4096,
        fileCount: 3,
      },
      {
        id: "t1",
        kind: "text",
        content: "Local note content",
      },
    ])

    expect(meta).toEqual([
      {
        id: "f1",
        kind: "file",
        name: "report.pdf",
        size: 1024,
        mimeType: "application/pdf",
      },
      {
        id: "d1",
        kind: "folder",
        name: "Assets",
        size: 4096,
        fileCount: 3,
      },
      {
        id: "t1",
        kind: "text",
        name: "Text Snippet",
        size: 18,
        textPreview: "Local note content",
      },
    ])
  })

  test("fflate streaming ZipPassThrough preserves nested paths and zero-byte files", () => {
    const outChunks: Uint8Array[] = []
    const zip = new Zip((err, chunk) => {
      if (err) throw err
      if (chunk) outChunks.push(chunk)
    })

    const e1 = new ZipPassThrough("Project/README.md")
    zip.add(e1)
    e1.push(new TextEncoder().encode("# Tesseract"), true)

    const e2 = new ZipPassThrough("Project/empty.txt")
    zip.add(e2)
    e2.push(new Uint8Array(0), true)

    zip.end()

    const totalLen = outChunks.reduce((acc, c) => acc + c.byteLength, 0)
    const archive = new Uint8Array(totalLen)
    let offset = 0
    for (const c of outChunks) {
      archive.set(c, offset)
      offset += c.byteLength
    }

    const extracted = unzipSync(archive)
    expect(Object.keys(extracted).sort()).toEqual([
      "Project/README.md",
      "Project/empty.txt",
    ])
    expect(new TextDecoder().decode(extracted["Project/README.md"])).toBe(
      "# Tesseract"
    )
    expect(extracted["Project/empty.txt"]!.byteLength).toBe(0)
  })
})

