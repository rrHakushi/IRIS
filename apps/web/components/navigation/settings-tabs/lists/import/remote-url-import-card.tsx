"use client"

import React, { useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconWorldDownload,
  IconLock,
  IconEye,
  IconEyeOff,
  IconArrowRight,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import {
  ImportItemSelectionDialog,
  type ImportItemPayload,
} from "./import-item-selection-dialog"

export function RemoteUrlImportCard(): React.JSX.Element {
  const { data: session } = useSession()
  const username = session?.user?.username

  const [url, setUrl] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // Dialog state
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false)
  const [parsedItems, setParsedItems] = useState<ImportItemPayload[]>([])

  const handleFetchPreview = async () => {
    if (!url.trim()) {
      toast.error("Please enter a valid remote export URL")
      return
    }
    if (!password) {
      toast.error("Please enter the export password")
      return
    }
    if (!username) {
      toast.error("You must be logged in to import lists")
      return
    }

    setIsFetching(true)
    try {
      const { data, error } = await elysia
        .user({ username })
        .lists.import["fetch-remote"].post(
          {
            url: url.trim(),
            password,
          },
          {
            fetch: { credentials: "include" },
          }
        )

      if (error || !data?.success || !data.data) {
        throw new Error(
          (error as any)?.value?.message ||
            "Failed to fetch data from remote URL"
        )
      }

      // Flatten the IRIS JSON data into ImportItemPayload[]
      const raw = data.data
      const flattened: ImportItemPayload[] = []

      if (raw.lists) {
        const listKeys: Array<keyof typeof raw.lists> = [
          "anime",
          "manga",
          "tv",
          "movie",
          "game",
          "book",
          "music",
        ]

        for (const key of listKeys) {
          const list = raw.lists[key]
          if (Array.isArray(list)) {
            for (const entry of list) {
              flattened.push({
                mediaType: key as any,
                title: entry.title || "Untitled",
                externalIds: entry.externalIds || {},
                status: entry.status || "PLANNING",
                progress: entry.progress,
                progressVolumes: entry.progressVolumes,
                progressPages: entry.progressPages,
                progressChapters: entry.progressChapters,
                score: entry.score,
                notes: entry.notes,
                rewatched: entry.rewatched,
                reread: entry.reread,
                replayed: entry.replayed,
                playCount: entry.playCount,
                startedAt: entry.startedAt,
                completedAt: entry.completedAt,
                connections: entry.connections,
              })
            }
          }
        }

        if (Array.isArray(raw.lists.customLists)) {
          for (const customList of raw.lists.customLists) {
            if (Array.isArray(customList.entries)) {
              for (const e of customList.entries) {
                flattened.push({
                  mediaType: "custom_lists",
                  title: e.title || "Untitled",
                  externalIds: e.externalIds || {},
                  status: "COMPLETED",
                  customListName: customList.name,
                  customNotes: e.customNotes,
                  order: e.order,
                })
              }
            }
          }
        }
      }

      if (flattened.length === 0) {
        toast.info("The remote export contained no list items to import.")
        return
      }

      setParsedItems(flattened)
      setSelectionDialogOpen(true)
    } catch (err: any) {
      toast.error(err.message || "Failed to connect or decrypt remote export.")
    } finally {
      setIsFetching(false)
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
      setUrl("")
      setPassword("")
    } catch (err: any) {
      toast.error(err.message || "An error occurred during import.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <IconWorldDownload className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Import from Remote IRIS Instance
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Enter an Export Share URL and Password generated on another IRIS
                app to synchronize lists directly.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Export Share URL
              </label>
              <Input
                placeholder="https://iris-app.com/api/lists/export/share/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter export password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-8 pe-8 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <IconEyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <IconEye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <Button
              variant="default"
              size="sm"
              onClick={handleFetchPreview}
              disabled={isFetching || !url.trim() || !password}
              className="h-8 gap-1.5 text-xs"
            >
              {isFetching ? (
                <>
                  <Spinner className="h-3.5 w-3.5" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Fetch & Review</span>
                  <IconArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {selectionDialogOpen && (
        <ImportItemSelectionDialog
          open={selectionDialogOpen}
          onOpenChange={setSelectionDialogOpen}
          sourceName="Remote IRIS Instance"
          items={parsedItems}
          onConfirmImport={handleConfirmImport}
          isSubmitting={isImporting}
        />
      )}
    </>
  )
}
