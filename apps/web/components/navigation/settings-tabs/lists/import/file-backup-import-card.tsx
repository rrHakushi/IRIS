"use client"

import React, { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconFileCode,
  IconUpload,
  IconX,
  IconCheck,
  IconFileTypeXml,
  IconFileTypeCsv,
  IconFileZip,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import {
  ImportItemSelectionDialog,
  type ImportItemPayload,
} from "./import-item-selection-dialog"

// Helper to decompress gzip in browser if .gz
async function decompressGzip(file: File): Promise<string> {
  if (typeof DecompressionStream !== "undefined") {
    const ds = new DecompressionStream("gzip")
    const stream = file.stream().pipeThrough(ds)
    const response = new Response(stream)
    return await response.text()
  } else {
    // Fallback reading as text if not supported or not gzip
    return await file.text()
  }
}

export function FileBackupImportCard(): React.JSX.Element {
  const { data: session } = useSession()
  const username = session?.user?.username

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)
  const [parsedSummary, setParsedSummary] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // Dialog state
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false)
  const [parsedItems, setParsedItems] = useState<ImportItemPayload[]>([])

  const parseIrisJson = (content: any): ImportItemPayload[] => {
    const items: ImportItemPayload[] = []
    if (content.lists) {
      const keys: Array<
        "anime" | "manga" | "tv" | "movie" | "game" | "book" | "music"
      > = ["anime", "manga", "tv", "movie", "game", "book", "music"]
      for (const k of keys) {
        const arr = content.lists[k]
        if (Array.isArray(arr)) {
          for (const item of arr) {
            items.push({
              mediaType: k,
              title: item.title || "Untitled",
              externalIds: item.externalIds || {},
              status: item.status || "PLANNING",
              progress: item.progress,
              progressVolumes: item.progressVolumes,
              progressPages: item.progressPages,
              progressChapters: item.progressChapters,
              score: item.score,
              notes: item.notes,
              rewatched: item.rewatched,
              reread: item.reread,
              replayed: item.replayed,
              playCount: item.playCount,
              startedAt: item.startedAt,
              completedAt: item.completedAt,
              connections: item.connections,
            })
          }
        }
      }

      if (Array.isArray(content.lists.customLists)) {
        for (const cl of content.lists.customLists) {
          if (Array.isArray(cl.entries)) {
            for (const e of cl.entries) {
              items.push({
                mediaType: "custom_lists",
                title: e.title || "Untitled",
                externalIds: e.externalIds || {},
                status: "COMPLETED",
                customListName: cl.name,
                customNotes: e.customNotes,
                order: e.order,
              })
            }
          }
        }
      }
    }
    return items
  }

  const parseMalXml = (xmlText: string): ImportItemPayload[] => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, "application/xml")
    const items: ImportItemPayload[] = []

    // Parse anime
    const animeNodes = doc.querySelectorAll("anime")
    animeNodes.forEach((node) => {
      const id = node.querySelector("series_animedb_id")?.textContent
      const title =
        node.querySelector("series_title")?.textContent || "Untitled Anime"
      const status =
        node.querySelector("my_status")?.textContent || "Plan to Watch"
      const score = node.querySelector("my_score")?.textContent
      const watched = node.querySelector("my_watched_episodes")?.textContent
      const notes = node.querySelector("my_comments")?.textContent
      const started = node.querySelector("my_start_date")?.textContent
      const finished = node.querySelector("my_finish_date")?.textContent
      const rewatched = node.querySelector("my_times_watched")?.textContent

      items.push({
        mediaType: "anime",
        title,
        externalIds: { malId: id ? Number(id) : null },
        status,
        progress: watched ? Number(watched) : 0,
        score: score && score !== "0" ? Number(score) : null,
        notes: notes || null,
        rewatched: rewatched ? Number(rewatched) : 0,
        startedAt: started && started !== "0000-00-00" ? started : null,
        completedAt: finished && finished !== "0000-00-00" ? finished : null,
      })
    })

    // Parse manga
    const mangaNodes = doc.querySelectorAll("manga")
    mangaNodes.forEach((node) => {
      const id = node.querySelector("manga_mangadb_id")?.textContent
      const title =
        node.querySelector("manga_title")?.textContent || "Untitled Manga"
      const status =
        node.querySelector("my_status")?.textContent || "Plan to Read"
      const score = node.querySelector("my_score")?.textContent
      const chapters = node.querySelector("my_read_chapters")?.textContent
      const volumes = node.querySelector("my_read_volumes")?.textContent
      const notes = node.querySelector("my_comments")?.textContent
      const started = node.querySelector("my_start_date")?.textContent
      const finished = node.querySelector("my_finish_date")?.textContent
      const reread = node.querySelector("my_times_read")?.textContent

      items.push({
        mediaType: "manga",
        title,
        externalIds: { malId: id ? Number(id) : null },
        status,
        progress: chapters ? Number(chapters) : 0,
        progressChapters: chapters ? Number(chapters) : 0,
        progressVolumes: volumes ? Number(volumes) : 0,
        score: score && score !== "0" ? Number(score) : null,
        notes: notes || null,
        reread: reread ? Number(reread) : 0,
        startedAt: started && started !== "0000-00-00" ? started : null,
        completedAt: finished && finished !== "0000-00-00" ? finished : null,
      })
    })

    return items
  }

  const parseSimklJson = (content: any): ImportItemPayload[] => {
    const items: ImportItemPayload[] = []
    const list = Array.isArray(content)
      ? content
      : [
          ...(Array.isArray(content.anime) ? content.anime : []),
          ...(Array.isArray(content.shows) ? content.shows : []),
          ...(Array.isArray(content.movies) ? content.movies : []),
        ]

    for (const entry of list) {
      const show = entry.show || entry.anime || entry.movie || entry
      const title =
        show.title || show.title_en || show.title_romaji || "Untitled"
      const ids = show.ids || {}

      let mediaType: "anime" | "tv" | "movie" = "tv"
      if (entry.anime || show.anime) mediaType = "anime"
      else if (entry.movie || show.movie) mediaType = "movie"

      items.push({
        mediaType,
        title,
        externalIds: {
          simklId: ids.simkl || entry.id,
          tvDBId: ids.tvdb ? Number(ids.tvdb) : null,
          malId: ids.mal ? Number(ids.mal) : null,
          anilistId: ids.anilist ? Number(ids.anilist) : null,
          tmdbId: ids.tmdb ? Number(ids.tmdb) : null,
          imdbId: ids.imdb ? String(ids.imdb) : null,
        },
        status: entry.status || "PLANNING",
        progress: entry.watched_episodes_count || 0,
        score: entry.user_rating || null,
        notes: entry.memo || null,
        startedAt: entry.created_at || entry.watched_at || null,
        completedAt: entry.last_watched_at || null,
      })
    }
    return items
  }

  const parseSimklCsv = (csvText: string): ImportItemPayload[] => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) return []

    const firstLine = lines[0]
    if (!firstLine) return []

    const header = firstLine.split(",").map((h) =>
      h
        .replace(/^["']|["']$/g, "")
        .trim()
        .toLowerCase()
    )
    const items: ImportItemPayload[] = []

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i]
      if (!currentLine) continue
      // Basic CSV split ignoring commas inside quotes
      const values = currentLine
        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map((v) => v.replace(/^["']|["']$/g, "").trim())
      const row: Record<string, string> = {}
      header.forEach((h, idx) => {
        if (h) {
          row[h] = values[idx] || ""
        }
      })

      const title = row["title"] || row["name"] || "Untitled"
      const rawType = (row["type"] || row["media_type"] || "").toLowerCase()
      let mediaType: "anime" | "tv" | "movie" = "tv"
      if (rawType.includes("anime")) mediaType = "anime"
      else if (rawType.includes("movie")) mediaType = "movie"

      items.push({
        mediaType,
        title,
        externalIds: {
          simklId: row["simkl id"] ? Number(row["simkl id"]) : null,
          tvDBId: row["tvdb id"] ? Number(row["tvdb id"]) : null,
          imdbId: row["imdb id"] || null,
          malId: row["mal id"] ? Number(row["mal id"]) : null,
        },
        status: row["status"] || "PLANNING",
        progress:
          row["watched episodes"] || row["episodes watched"]
            ? Number(row["watched episodes"] || row["episodes watched"])
            : 0,
        score:
          row["user rating"] || row["rating"]
            ? Number(row["user rating"] || row["rating"])
            : null,
      })
    }
    return items
  }

  const handleProcessFile = async (file: File) => {
    setIsParsing(true)
    try {
      let textContent = ""
      const isGzip = file.name.endsWith(".gz") || file.name.endsWith(".xml.gz")

      if (isGzip) {
        textContent = await decompressGzip(file)
      } else {
        textContent = await file.text()
      }

      let parsed: ImportItemPayload[] = []
      let formatName = ""

      // 1. Try IRIS JSON or Simkl JSON
      if (
        file.name.endsWith(".json") ||
        (!isGzip && textContent.trim().startsWith("{")) ||
        textContent.trim().startsWith("[")
      ) {
        try {
          const json = JSON.parse(textContent)
          if (json.source === "IRIS" || json.lists) {
            formatName = "IRIS JSON Backup"
            parsed = parseIrisJson(json)
          } else {
            formatName = "Simkl JSON"
            parsed = parseSimklJson(json)
          }
        } catch {
          // not JSON
        }
      }

      // 2. Try XML (MAL)
      if (
        !parsed.length &&
        (file.name.endsWith(".xml") ||
          file.name.endsWith(".xml.gz") ||
          textContent.includes("<myanimelist>"))
      ) {
        formatName = "MyAnimeList XML"
        parsed = parseMalXml(textContent)
      }

      // 3. Try CSV (Simkl)
      if (
        !parsed.length &&
        (file.name.endsWith(".csv") ||
          textContent.toLowerCase().includes("simkl id"))
      ) {
        formatName = "Simkl CSV"
        parsed = parseSimklCsv(textContent)
      }

      if (parsed.length === 0) {
        throw new Error(
          "Could not detect any valid media items from this backup file."
        )
      }

      setSelectedFile(file)
      setDetectedFormat(formatName)
      setParsedSummary(`${parsed.length} items detected (${formatName})`)
      setParsedItems(parsed)
    } catch (err: any) {
      toast.error(
        err.message ||
          "Failed to parse backup file. Please ensure it is a valid format."
      )
      handleClear()
    } finally {
      setIsParsing(false)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    setDetectedFormat(null)
    setParsedSummary(null)
    setParsedItems([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleConfirmImport = async (
    selectedItems: ImportItemPayload[],
    skipExisting: boolean
  ) => {
    if (!username) return
    setIsImporting(true)

    try {
      const { data, error } = await elysia.user({ username }).lists.import.post(
        {
          items: selectedItems as any,
          skipExisting,
        },
        {
          fetch: { credentials: "include" },
        }
      )

      if (error || !data?.success) {
        throw new Error(
          (error as any)?.value?.message || "Failed to execute import"
        )
      }

      toast.success(
        `Import complete! Processed ${data.total} item(s): ${data.imported} created, ${data.updated} updated${data.queued > 0 ? `, ${data.queued} queued for metadata enrichment` : ""}.`
      )
      setSelectionDialogOpen(false)
      handleClear()
    } catch (err: any) {
      toast.error(err.message || "An error occurred during file import.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Import from Backup File
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Supports IRIS JSON, MyAnimeList XML (.xml, .xml.gz), and Simkl
                backup files (.json, .csv).
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                JSON
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                MAL XML
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                SIMKL
              </Badge>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.xml,.gz,.csv,application/json,application/xml,text/xml,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleProcessFile(file)
            }}
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file) handleProcessFile(file)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <IconUpload className="h-5 w-5" />
              </div>
              <p className="mt-2 text-xs font-medium text-foreground">
                {isParsing
                  ? "Reading and analyzing file..."
                  : "Drag & drop backup file here"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                or click to browse from your computer (.json, .xml, .xml.gz,
                .csv)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {detectedFormat?.includes("XML") ? (
                    <IconFileTypeXml className="h-5 w-5" />
                  ) : detectedFormat?.includes("CSV") ? (
                    <IconFileTypeCsv className="h-5 w-5" />
                  ) : selectedFile.name.endsWith(".gz") ? (
                    <IconFileZip className="h-5 w-5" />
                  ) : (
                    <IconFileCode className="h-5 w-5" />
                  )}
                </div>
                <div className="max-w-[280px] truncate text-start">
                  <p className="truncate text-xs font-medium text-foreground">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {parsedSummary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={isImporting}
                  className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconX className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setSelectionDialogOpen(true)}
                  disabled={isImporting}
                  className="h-8 gap-1.5 text-xs"
                >
                  <IconCheck className="h-3.5 w-3.5" />
                  <span>Review & Import</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectionDialogOpen && (
        <ImportItemSelectionDialog
          open={selectionDialogOpen}
          onOpenChange={setSelectionDialogOpen}
          sourceName={detectedFormat || "Backup File"}
          items={parsedItems}
          onConfirmImport={handleConfirmImport}
          isSubmitting={isImporting}
        />
      )}
    </>
  )
}
