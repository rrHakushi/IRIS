"use client"

import React, { useState, useEffect } from "react"
import { elysia } from "@/lib/elysia"
import { Button } from "@workspace/ui/components/button"
import { Switch } from "@workspace/ui/components/switch"
import {
  IconHistory,
  IconTrash,
  IconBrowser,
  IconCopy,
  IconCheck,
  IconInfoCircle,
} from "@tabler/icons-react"
import { toast } from "sonner"
import type { SettingsTabProps } from "../types"

export function SearchSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const [historyEnabled, setHistoryEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-iris-instance.com"
  const searchEngineUrl = `${origin}/IRIS-search?q=%s`

  useEffect(() => {
    let isMounted = true
    async function loadSettings() {
      try {
        const res = await elysia.webSearch.settings.get()
        if (res.data?.success && isMounted) {
          setHistoryEnabled(res.data.settings.historyEnabled)
        }
      } catch (err) {
        console.error("Failed to load search settings:", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    loadSettings()
    return () => {
      isMounted = false
    }
  }, [])

  const handleToggleHistory = async (checked: boolean) => {
    setIsUpdating(true)
    setHistoryEnabled(checked)
    try {
      const res = await elysia.webSearch.settings.patch({
        historyEnabled: checked,
      })
      if (res.data?.success) {
        toast.success(checked ? "Search history enabled" : "Search history paused")
      } else {
        setHistoryEnabled(!checked)
        toast.error("Failed to update history setting")
      }
    } catch {
      setHistoryEnabled(!checked)
      toast.error("Failed to update history setting")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleClearHistory = async () => {
    if (!confirmClear) {
      setConfirmClear(true)
      return
    }

    setIsClearing(true)
    try {
      const res = await elysia.webSearch.history.delete()
      if (res.data?.success) {
        toast.success("Search history cleared completely")
        setConfirmClear(false)
      } else {
        toast.error("Failed to clear search history")
      }
    } catch {
      toast.error("Failed to clear search history")
    } finally {
      setIsClearing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedUrl(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <div className="space-y-6 text-foreground">
      {/* Search History Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold">
          <IconHistory className="size-5 text-primary" />
          <span>Search History</span>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">Record Search History</span>
            <Switch
              isSelected={historyEnabled}
              isDisabled={isLoading || isUpdating}
              onChange={handleToggleHistory}
            />
          </div>

          <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-destructive">Clear History</span>
            <div className="flex items-center gap-2">
              {confirmClear && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmClear(false)}
                  isDisabled={isClearing}
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                variant={confirmClear ? "destructive" : "outline"}
                isDisabled={isClearing}
                onClick={handleClearHistory}
                className="gap-1.5"
              >
                <IconTrash className="size-4" />
                {confirmClear ? "Confirm Clear" : "Clear All History"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Browser Integration Section */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-base font-semibold">
          <IconBrowser className="size-5 text-primary" />
          <span>Browser Search Engine</span>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Search URL Template
            </span>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-xs bg-muted/60 p-2.5 rounded-lg select-all truncate border border-border/30">
                {searchEngineUrl}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(searchEngineUrl)}
                className="gap-1.5 shrink-0"
              >
                {copiedUrl ? <IconCheck className="size-4 text-emerald-500" /> : <IconCopy className="size-4" />}
                {copiedUrl ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <IconInfoCircle className="size-4 shrink-0 text-primary mt-0.5" />
            <div>
              <span>
                <strong>Authentication:</strong> In your browser, search queries use your existing IRIS login session automatically.
                For external CLI scripts or extensions, pass the <code className="text-foreground bg-muted px-1 py-0.5 rounded">x-api-key</code> or <code className="text-foreground bg-muted px-1 py-0.5 rounded">Authorization: Bearer &lt;key&gt;</code> header.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SearchSettingsTab
