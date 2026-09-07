"use client"

import React, { useState, useRef } from "react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconFileCode,
  IconUpload,
  IconX,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

export function FileBackupImportCard(): React.JSX.Element {
  const t = useTranslations("navigation.settings.lists.import")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [parsedSummary, setParsedSummary] = useState<string | null>(null)

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      toast.error("Please select a valid JSON backup file.")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string)
        setSelectedFile(file)
        
        // Compute brief summary if recognizable structure
        let summary = `${(file.size / 1024).toFixed(1)} KB`
        if (typeof content === "object" && content !== null) {
          const keys = Object.keys(content)
          summary += ` (${keys.length} categories)`
        }
        setParsedSummary(summary)
      } catch {
        toast.error("Failed to parse JSON file. The file may be corrupt.")
      }
    }
    reader.readAsText(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleClear = () => {
    setSelectedFile(null)
    setParsedSummary(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleImport = async () => {
    if (!selectedFile) return
    setIsImporting(true)
    try {
      // Simulate file backup processing
      await new Promise((resolve) => setTimeout(resolve, 1500))
      toast.success(
        t("completed", { processed: 1 })
      )
      handleClear()
    } catch {
      toast.error("Failed to import backup file.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200 hover:border-border hover:shadow-sm">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            {t("fileImportTitle")}
          </h4>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              handleFile(file)
            }
          }}
          className="hidden"
        />

        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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
              {t("dragDropHere")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("clickToBrowse")}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <IconFileCode className="h-5 w-5" />
              </div>
              <div className="max-w-[240px] truncate text-start">
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
                <span>{t("clearFile")}</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleImport}
                disabled={isImporting}
                className="h-8 gap-1.5 text-xs"
              >
                {isImporting ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    <span>{t("importing")}</span>
                  </>
                ) : (
                  <>
                    <IconUpload className="h-3.5 w-3.5" />
                    <span>{t("startImport")}</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
