"use client"

import React, { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClipboardText,
  IconCopy,
  IconDevices,
  IconDownload,
  IconExternalLink,
  IconFile,
  IconFolder,
  IconFolderDown,
  IconInfoCircle,
  IconLink,
  IconRefresh,
  IconSend,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  Popover,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"
import { useTesseract } from "@/context/tesseract-context"
import { copyTextToClipboard, formatBytes } from "@/lib/tesseract/device-info"
import { supportsDirectoryPicker } from "@/lib/tesseract/download-writer"
import type {
  RemoteFolderItem,
  RemoteShelfItem,
  TesseractPeer,
} from "@/lib/tesseract/types"
import { DeviceTypeIcon } from "./device-icon"
import { TransferActivityBar } from "./transfer-activity-bar"

interface DownloadSelectionSpec {
  key: string
  peerId: string
  itemId: string
  fileId?: string
  name: string
  size: number
}

function makeSelectionKey(peerId: string, id: string) {
  return `${peerId}::${id}`
}

export function SharedByOthersPanel({
  onOpenDirectSend,
}: {
  onOpenDirectSend: (peer: TesseractPeer) => void
}) {
  const t = useTranslations("tesseract")
  const {
    isAuthenticated,
    currentUserId,
    filteredPeers,
    myDevicesOnly,
    setMyDevicesOnly,
    peerDiagnostics,
    remoteShelves,
    receivedDirectTexts,
    dismissReceivedDirectText,
    retryPeerConnection,
    pullItemsFromPeer,
    transfers,
  } = useTesseract()

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dirPickerSupported] = useState(() => supportsDirectoryPicker())

  const selectionMap = useMemo(() => {
    const map = new Map<string, DownloadSelectionSpec>()
    for (const peer of filteredPeers) {
      const items = remoteShelves[peer.peerId] || []
      for (const item of items) {
        if (item.kind === "file") {
          const key = makeSelectionKey(peer.peerId, item.id)
          map.set(key, {
            key,
            peerId: peer.peerId,
            itemId: item.id,
            fileId: item.id,
            name: item.name,
            size: item.size,
          })
        } else if (item.kind === "folder") {
          for (const entry of item.files) {
            const key = makeSelectionKey(peer.peerId, entry.id)
            map.set(key, {
              key,
              peerId: peer.peerId,
              itemId: item.id,
              fileId: entry.id,
              name: entry.name,
              size: entry.size,
            })
          }
        }
      }
    }
    return map
  }, [filteredPeers, remoteShelves])

  const selectedSpecs = useMemo(() => {
    const list: DownloadSelectionSpec[] = []
    for (const key of selectedKeys) {
      const spec = selectionMap.get(key)
      if (spec) list.push(spec)
    }
    return list
  }, [selectedKeys, selectionMap])

  const toggleKey = (key: string, next: boolean) => {
    setSelectedKeys((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(key)
      else copy.delete(key)
      return copy
    })
  }

  const toggleFolderWhole = (
    peerId: string,
    folder: RemoteFolderItem,
    next: boolean
  ) => {
    setSelectedKeys((prev) => {
      const copy = new Set(prev)
      for (const entry of folder.files) {
        const key = makeSelectionKey(peerId, entry.id)
        if (next) copy.add(key)
        else copy.delete(key)
      }
      return copy
    })
  }

  const getFolderSelectionState = (peerId: string, folder: RemoteFolderItem) => {
    if (folder.files.length === 0) {
      return { allSelected: false, indeterminate: false }
    }
    let count = 0
    for (const entry of folder.files) {
      if (selectedKeys.has(makeSelectionKey(peerId, entry.id))) count += 1
    }
    return {
      allSelected: count === folder.files.length,
      indeterminate: count > 0 && count < folder.files.length,
    }
  }

  const handleCopyText = async (id: string, text: string) => {
    const ok = await copyTextToClipboard(text)
    if (ok) {
      setCopiedId(id)
      toast.success(t("toasts.copiedToClipboard"))
      setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr))
      }, 2_000)
    }
  }

  const handleDownloadSelected = async (
    saveMode: "auto" | "directory" = "auto"
  ) => {
    if (selectedSpecs.length === 0) return

    const byPeer = new Map<string, DownloadSelectionSpec[]>()
    for (const spec of selectedSpecs) {
      const group = byPeer.get(spec.peerId) || []
      group.push(spec)
      byPeer.set(spec.peerId, group)
    }

    for (const [peerId, specs] of byPeer) {
      const totalBytes = specs.reduce((acc, s) => acc + s.size, 0)
      const fileIds = specs.map((s) => s.fileId!).filter(Boolean)
      const itemIds = Array.from(new Set(specs.map((s) => s.itemId)))
      const summaryName =
        specs.length === 1
          ? specs[0]!.name
          : `tesseract-selected-${specs.length}-files`

      await pullItemsFromPeer({
        peerId,
        itemIds,
        fileIds,
        saveMode:
          saveMode === "directory"
            ? "directory"
            : specs.length > 1
              ? "zip"
              : "auto",
        summaryName,
        fileCount: specs.length,
        totalBytes,
        singleFileName: specs.length === 1 ? specs[0]!.name : undefined,
      })
    }

    setSelectedKeys(new Set())
  }

  const handleDownloadFolder = async (
    peerId: string,
    folder: RemoteFolderItem,
    saveMode: "zip" | "directory"
  ) => {
    await pullItemsFromPeer({
      peerId,
      itemIds: [folder.id],
      saveMode,
      summaryName: folder.name,
      fileCount: folder.fileCount,
      totalBytes: folder.totalSize,
    })
  }

  const totalRemoteItems = useMemo(() => {
    let count = 0
    for (const peer of filteredPeers) {
      count += (remoteShelves[peer.peerId] || []).length
    }
    return count
  }, [filteredPeers, remoteShelves])

  const selectedTotalBytes = useMemo(
    () => selectedSpecs.reduce((acc, s) => acc + s.size, 0),
    [selectedSpecs]
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-card/50 p-4 shadow-xs">
      {/* Available Files Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">
            {t("sharedByOthers.shelfTitle")}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {totalRemoteItems}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isAuthenticated && (
            <Button
              type="button"
              size="xs"
              variant={myDevicesOnly ? "default" : "outline"}
              onClick={() => setMyDevicesOnly(!myDevicesOnly)}
              className={cn(
                myDevicesOnly &&
                  "bg-lime-500 text-zinc-950 hover:bg-lime-400"
              )}
            >
              <IconDevices data-icon="inline-start" className="size-3.5" />
              <span>{t("header.myDevicesFilter")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Multi-selection batch bar */}
      {selectedSpecs.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-lime-500/30 bg-lime-500/10 px-3 py-2">
          <span className="text-xs font-medium text-foreground">
            {t("sharedByOthers.selectedSummary", {
              count: selectedSpecs.length,
              size: formatBytes(selectedTotalBytes),
            })}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              onClick={() => void handleDownloadSelected("auto")}
              className="bg-lime-500 text-zinc-950 hover:bg-lime-400"
            >
              <IconDownload data-icon="inline-start" className="size-3.5" />
              <span>{t("sharedByOthers.downloadSelected")}</span>
            </Button>
            {isAuthenticated && dirPickerSupported && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => void handleDownloadSelected("directory")}
              >
                <IconFolderDown data-icon="inline-start" className="size-3.5" />
                <span>{t("sharedByOthers.saveToFolder")}</span>
              </Button>
            )}
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setSelectedKeys(new Set())}
            >
              {t("common.clear")}
            </Button>
          </div>
        </div>
      )}

      {/* Received Direct Text Snippets */}
      {receivedDirectTexts.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {receivedDirectTexts.map((bundle) => (
            <div
              key={bundle.id}
              className="rounded-xl border border-lime-500/40 bg-lime-500/10 p-3"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {t("sharedByOthers.directTextFrom", {
                    peer: bundle.fromAlias,
                  })}
                </span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => dismissReceivedDirectText(bundle.id)}
                  aria-label={t("common.dismiss")}
                >
                  <IconX className="size-3.5" />
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {bundle.items.map((txt) => (
                  <div
                    key={txt.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-background/80 p-2 text-xs"
                  >
                    <span className="line-clamp-2 min-w-0 flex-1 break-all">
                      {txt.content}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleCopyText(txt.id, txt.content)}
                        aria-label={t("common.copy")}
                      >
                        {copiedId === txt.id ? (
                          <IconCheck className="size-3.5 text-lime-500" />
                        ) : (
                          <IconCopy className="size-3.5" />
                        )}
                      </Button>
                      {txt.isUrl && /^https?:\/\//i.test(txt.content) && (
                        <a
                          href={txt.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex size-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={t("sharedByOthers.openLink")}
                        >
                          <IconExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available Files & Peer Shelves */}
      <ScrollArea className="flex-1 pe-1">
        {filteredPeers.length === 0 ? (
          <div className="flex h-full min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-12 text-center">
            <p className="text-xs font-medium text-foreground">
              {t("sharedByOthers.noPeersTitle")}
            </p>
            <p className="mt-1 max-w-sm text-[11px] text-muted-foreground">
              {t("sharedByOthers.noPeersHint")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredPeers.map((peer) => {
              const items: RemoteShelfItem[] = remoteShelves[peer.peerId] || []
              const diag = peerDiagnostics[peer.peerId] ?? { state: "idle" }
              const isSameAccount = Boolean(
                currentUserId && peer.user?.id === currentUserId
              )
              const canDirectSend = isAuthenticated && peer.isAuthenticated

              return (
                <div
                  key={peer.peerId}
                  className="rounded-xl border border-border/60 bg-background/60 p-3"
                >
                  {/* Peer header row */}
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <DeviceTypeIcon
                        deviceType={peer.deviceType}
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="truncate text-xs font-semibold text-foreground">
                        {peer.alias}
                      </span>

                      {peer.user ? (
                        <Badge
                          variant="secondary"
                          className="shrink-0 gap-1 py-0.5 ps-1 pe-2 text-[10px]"
                        >
                          <Avatar className="size-3.5">
                            {peer.user.avatarUrl ? (
                              <AvatarImage
                                src={peer.user.avatarUrl}
                                alt={peer.user.displayName}
                              />
                            ) : null}
                            <AvatarFallback className="text-[8px]">
                              {peer.user.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>@{peer.user.username}</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] text-muted-foreground"
                        >
                          {t("sharedByOthers.guestBadge")}
                        </Badge>
                      )}

                      {isSameAccount && (
                        <Badge className="h-4 bg-lime-500/20 px-1.5 text-[10px] text-lime-600 dark:text-lime-400">
                          {t("sharedByOthers.yourDeviceBadge")}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {diag.state === "connected" && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-lime-600 dark:text-lime-400">
                          <span className="size-1.5 rounded-full bg-lime-500" />
                          <span>
                            {diag.candidateType
                              ? t("sharedByOthers.p2pConnectedType", {
                                  type: diag.candidateType,
                                })
                              : t("sharedByOthers.p2pConnected")}
                          </span>
                        </span>
                      )}

                      {(diag.state === "connecting" ||
                        diag.state === "idle") && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                          <span>{t("sharedByOthers.p2pConnecting")}</span>
                        </span>
                      )}

                      {diag.state === "unreachable" && (
                        <div className="flex items-center gap-1 text-[11px] text-rose-500">
                          <IconAlertTriangle className="size-3.5 shrink-0" />
                          <span>{t("sharedByOthers.p2pUnreachable")}</span>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => retryPeerConnection(peer.peerId)}
                            className="h-5 px-1.5 text-[11px]"
                          >
                            <IconRefresh className="size-3" />
                            <span>{t("common.retry")}</span>
                          </Button>
                          <PopoverTrigger>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              aria-label={t("sharedByOthers.diagnosticsHelp")}
                              className="size-5"
                            >
                              <IconInfoCircle className="size-3.5" />
                            </Button>
                            <Popover className="w-72">
                              <PopoverHeader>
                                <PopoverTitle>
                                  {t("sharedByOthers.diagnosticsTitle")}
                                </PopoverTitle>
                                <PopoverDescription>
                                  {diag.errorReason ||
                                    t("sharedByOthers.diagnosticsHint")}
                                </PopoverDescription>
                              </PopoverHeader>
                            </Popover>
                          </PopoverTrigger>
                        </div>
                      )}

                      {canDirectSend && (
                        <Button
                          type="button"
                          size="xs"
                          variant="secondary"
                          onClick={() => onOpenDirectSend(peer)}
                          disabled={diag.state === "unreachable"}
                        >
                          <IconSend
                            data-icon="inline-start"
                            className="size-3"
                          />
                          <span>{t("sharedByOthers.directSend")}</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <p className="py-2 text-center text-[11px] text-muted-foreground">
                      {t("sharedByOthers.shelfEmpty")}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {items.map((item) => {
                        if (item.kind === "file") {
                          const key = makeSelectionKey(peer.peerId, item.id)
                          return (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-card/70 p-2.5"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <Checkbox
                                  isSelected={selectedKeys.has(key)}
                                  onChange={(val) => toggleKey(key, val)}
                                  aria-label={item.name}
                                />
                                <IconFile className="size-4 shrink-0 text-muted-foreground" />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-foreground">
                                    {item.name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {formatBytes(item.size)}
                                  </p>
                                </div>
                              </div>

                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  void pullItemsFromPeer({
                                    peerId: peer.peerId,
                                    itemIds: [item.id],
                                    fileIds: [item.id],
                                    saveMode: "auto",
                                    summaryName: item.name,
                                    fileCount: 1,
                                    totalBytes: item.size,
                                    singleFileName: item.name,
                                  })
                                }
                              >
                                <IconDownload
                                  data-icon="inline-start"
                                  className="size-3.5"
                                />
                                <span>{t("common.download")}</span>
                              </Button>
                            </li>
                          )
                        }

                        if (item.kind === "folder") {
                          const folderKey = makeSelectionKey(
                            peer.peerId,
                            item.id
                          )
                          const isExpanded = expandedFolders.has(folderKey)
                          const { allSelected, indeterminate } =
                            getFolderSelectionState(peer.peerId, item)

                          return (
                            <li
                              key={item.id}
                              className="rounded-xl border border-border/50 bg-card/70 p-2.5"
                            >
                              <Collapsible
                                isExpanded={isExpanded}
                                onExpandedChange={(open) => {
                                  setExpandedFolders((prev) => {
                                    const next = new Set(prev)
                                    if (open) next.add(folderKey)
                                    else next.delete(folderKey)
                                    return next
                                  })
                                }}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <Checkbox
                                      isSelected={allSelected}
                                      isIndeterminate={indeterminate}
                                      onChange={(val) =>
                                        toggleFolderWhole(
                                          peer.peerId,
                                          item,
                                          val
                                        )
                                      }
                                      aria-label={item.name}
                                    />
                                    <CollapsibleTrigger className="inline-flex min-w-0 items-center gap-1.5 text-start">
                                      {isExpanded ? (
                                        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                                      ) : (
                                        <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
                                      )}
                                      <IconFolder className="size-4 shrink-0 text-lime-500" />
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-foreground">
                                          {item.name}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                          {t("common.folderSummary", {
                                            count: item.fileCount,
                                            size: formatBytes(item.totalSize),
                                          })}
                                        </p>
                                      </div>
                                    </CollapsibleTrigger>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {isAuthenticated && dirPickerSupported && (
                                      <Button
                                        type="button"
                                        size="xs"
                                        variant="outline"
                                        onClick={() =>
                                          void handleDownloadFolder(
                                            peer.peerId,
                                            item,
                                            "directory"
                                          )
                                        }
                                      >
                                        <IconFolderDown
                                          data-icon="inline-start"
                                          className="size-3.5"
                                        />
                                        <span>
                                          {t("sharedByOthers.saveFolder")}
                                        </span>
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="outline"
                                      onClick={() =>
                                        void handleDownloadFolder(
                                          peer.peerId,
                                          item,
                                          "zip"
                                        )
                                      }
                                    >
                                      <IconDownload
                                        data-icon="inline-start"
                                        className="size-3.5"
                                      />
                                      <span>
                                        {t("sharedByOthers.downloadZip")}
                                      </span>
                                    </Button>
                                  </div>
                                </div>

                                <CollapsibleContent className="mt-2 border-t border-border/50 pt-2">
                                  <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto ps-6">
                                    {item.files.map((entry) => {
                                      const entryKey = makeSelectionKey(
                                        peer.peerId,
                                        entry.id
                                      )
                                      return (
                                        <li
                                          key={entry.id}
                                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted/50"
                                        >
                                          <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <Checkbox
                                              isSelected={selectedKeys.has(
                                                entryKey
                                              )}
                                              onChange={(val) =>
                                                toggleKey(entryKey, val)
                                              }
                                              aria-label={entry.relativePath}
                                            />
                                            <span className="truncate text-[11px] text-foreground">
                                              {entry.relativePath}
                                            </span>
                                          </div>
                                          <div className="flex shrink-0 items-center gap-2">
                                            <span className="text-[11px] text-muted-foreground">
                                              {formatBytes(entry.size)}
                                            </span>
                                            <Button
                                              type="button"
                                              size="icon-xs"
                                              variant="ghost"
                                              aria-label={t("common.download")}
                                              onClick={() =>
                                                void pullItemsFromPeer({
                                                  peerId: peer.peerId,
                                                  itemIds: [item.id],
                                                  fileIds: [entry.id],
                                                  saveMode: "auto",
                                                  summaryName: entry.name,
                                                  fileCount: 1,
                                                  totalBytes: entry.size,
                                                  singleFileName: entry.name,
                                                })
                                              }
                                            >
                                              <IconDownload className="size-3.5" />
                                            </Button>
                                          </div>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </CollapsibleContent>
                              </Collapsible>
                            </li>
                          )
                        }

                        return (
                          <li
                            key={item.id}
                            className="flex items-start justify-between gap-2 rounded-xl border border-border/50 bg-card/70 p-2.5"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-2.5">
                              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-lime-500/10 text-lime-500">
                                {item.isUrl ? (
                                  <IconLink className="size-3.5" />
                                ) : (
                                  <IconClipboardText className="size-3.5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                {item.title && (
                                  <p className="truncate text-xs font-medium text-foreground">
                                    {item.title}
                                  </p>
                                )}
                                <p className="line-clamp-3 break-all text-xs text-muted-foreground">
                                  {item.content}
                                </p>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                size="xs"
                                variant="outline"
                                onClick={() =>
                                  handleCopyText(item.id, item.content)
                                }
                              >
                                {copiedId === item.id ? (
                                  <IconCheck
                                    data-icon="inline-start"
                                    className="size-3.5 text-lime-500"
                                  />
                                ) : (
                                  <IconCopy
                                    data-icon="inline-start"
                                    className="size-3.5"
                                  />
                                )}
                                <span>{t("common.copy")}</span>
                              </Button>

                              {item.isUrl &&
                                /^https?:\/\//i.test(item.content) && (
                                  <a
                                    href={item.content}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex h-6 items-center gap-1 rounded-2xl border border-border px-2 text-xs font-medium text-foreground hover:bg-muted"
                                  >
                                    <IconExternalLink className="size-3.5" />
                                    <span>
                                      {t("sharedByOthers.openLink")}
                                    </span>
                                  </a>
                                )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Compact transfer status docked inside the right area */}
      {transfers.length > 0 && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <TransferActivityBar embedded />
        </div>
      )}
    </section>
  )
}
