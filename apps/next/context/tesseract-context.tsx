"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type {
  TesseractDirectOfferPayload,
  TesseractPeer,
  TesseractServerEvent,
} from "@NamelessLiberty/shared"
import { useSession } from "@/context/session-context"
import { useUser } from "@/context/user-context"
import {
  detectDeviceMetadata,
  isLikelyUrl,
  type DroppedFolderSpec,
} from "@/lib/tesseract/device-info"
import {
  createDirectoryWriterSink,
  createSingleFileSink,
  createStreamingZipSink,
  pickSaveFileHandle,
  pickTargetDirectoryHandle,
  supportsSaveFilePicker,
  UserCancelledSaveError,
} from "@/lib/tesseract/download-writer"
import { TesseractSignalingClient } from "@/lib/tesseract/signaling-client"
import {
  buildTransferItemMetaList,
  TesseractWebRtcMesh,
  type DirectTextDeliverPayload,
  type PullDecisionPayload,
  type PullRequestPayload,
} from "@/lib/tesseract/webrtc-mesh"
import type {
  IncomingShelfApprovalRequest,
  OutgoingTransferFileSpec,
  PeerConnectionDiagnostics,
  RemoteShelfItem,
  SharedLocalFileEntry,
  SharedLocalItem,
  TransferTask,
} from "@/lib/tesseract/types"

const STORAGE_KEY_ALIAS = "iris:tesseract:alias"
const STORAGE_KEY_APPROVAL = "iris:tesseract:require-shelf-approval"
const STORAGE_KEY_AUTO_ACCEPT = "iris:tesseract:auto-accept-own"
const STORAGE_KEY_DEVICE_ID = "iris:tesseract:device-id"
const STORAGE_KEY_TAB_ID = "iris:tesseract:tab-id"

function getOrCreateStorageId(storage: Storage | undefined, key: string): string {
  const fallback =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  if (!storage) return fallback
  try {
    const existing = storage.getItem(key)?.trim()
    if (existing) return existing
    storage.setItem(key, fallback)
  } catch {}
  return fallback
}

interface PendingReceivePlan {
  saveMode: "auto" | "zip" | "directory"
  zipFilename: string
  fileHandle: FileSystemFileHandle | null
  directoryHandle: FileSystemDirectoryHandle | null
}

interface PendingOutgoingPullData {
  peerId: string
  request: PullRequestPayload
  fileSpecs: OutgoingTransferFileSpec[]
}

interface PendingOutgoingDirectData {
  peerId: string
  fileSpecs: OutgoingTransferFileSpec[]
  textItems: DirectTextDeliverPayload["items"]
  totalBytes: number
  fileCount: number
  summaryName: string
}

export interface DirectReceivedTextNotification {
  id: string
  fromAlias: string
  items: DirectTextDeliverPayload["items"]
  receivedAt: number
}

export interface TesseractContextValue {
  mounted: boolean
  isAuthenticated: boolean
  currentUserId: string | null
  selfPeerId: string | null
  selfPeer: TesseractPeer | null
  transportState: "connecting" | "connected" | "disconnected"
  transportMode: "ws" | "sse"
  alias: string
  setAlias: (nextAlias: string) => void
  requireShelfApproval: boolean
  setRequireShelfApproval: (enabled: boolean) => void
  autoAcceptOwnDevices: boolean
  setAutoAcceptOwnDevices: (enabled: boolean) => void
  myDevicesOnly: boolean
  setMyDevicesOnly: (enabled: boolean) => void
  peers: TesseractPeer[]
  filteredPeers: TesseractPeer[]
  peerDiagnostics: Record<string, PeerConnectionDiagnostics>
  sharedByYou: SharedLocalItem[]
  remoteShelves: Record<string, RemoteShelfItem[]>
  transfers: TransferTask[]
  receivedDirectTexts: DirectReceivedTextNotification[]
  dismissReceivedDirectText: (id: string) => void
  pendingDirectOffers: TesseractDirectOfferPayload[]
  pendingShelfApprovals: IncomingShelfApprovalRequest[]
  retryPeerConnection: (peerId: string) => void
  addFilesToShelf: (files: File[]) => void
  addFoldersToShelf: (folders: DroppedFolderSpec[]) => void
  addTextToShelf: (content: string, title?: string) => void
  removeLocalItem: (itemId: string) => void
  clearLocalShelf: () => void
  handleDataTransferDropOrPaste: (
    dataTransfer: DataTransfer,
    source?: "drop" | "paste"
  ) => Promise<boolean>
  pullItemsFromPeer: (options: {
    peerId: string
    itemIds: string[]
    fileIds?: string[]
    saveMode?: "auto" | "zip" | "directory"
    summaryName: string
    fileCount: number
    totalBytes: number
    singleFileName?: string
  }) => Promise<void>
  sendDirectToPeer: (options: {
    peerId: string
    files: File[]
    folders: DroppedFolderSpec[]
    texts: Array<{ content: string; title?: string }>
  }) => Promise<boolean>
  respondToDirectOffer: (
    offerId: string,
    accepted: boolean,
    saveMode?: "auto" | "zip" | "directory"
  ) => Promise<void>
  respondToShelfApproval: (requestId: string, approved: boolean) => void
  cancelTransfer: (transferId: string) => void
  clearCompletedTransfers: () => void
  deviceInfo: {
    deviceType: "desktop" | "mobile" | "tablet"
    os: string
    browser: string
  }
}

const TesseractContext = createContext<TesseractContextValue | null>(null)

function buildLocalManifest(items: SharedLocalItem[]): RemoteShelfItem[] {
  return items.map((item) => {
    if (item.kind === "file") {
      return {
        id: item.id,
        kind: "file",
        name: item.name,
        size: item.size,
        mimeType: item.mimeType,
        lastModified: item.lastModified,
      }
    }
    if (item.kind === "folder") {
      return {
        id: item.id,
        kind: "folder",
        name: item.name,
        totalSize: item.totalSize,
        fileCount: item.fileCount,
        files: item.files.map((f) => ({
          id: f.id,
          relativePath: f.relativePath,
          name: f.name,
          size: f.size,
          mimeType: f.mimeType,
          lastModified: f.lastModified,
        })),
      }
    }
    return {
      id: item.id,
      kind: "text",
      title: item.title,
      content: item.content,
      isUrl: item.isUrl,
      createdAt: item.createdAt,
    }
  })
}

export function TesseractProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("tesseract")
  const { data: session, status: sessionStatus } = useSession()
  const { user } = useUser()

  const isAuthenticated = Boolean(session?.user?.id)
  const currentUserId = session?.user?.id ?? null

  const [mounted, setMounted] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<{
    deviceType: "desktop" | "mobile" | "tablet"
    os: string
    browser: string
    defaultAlias: string
  }>({
    deviceType: "desktop",
    os: "Desktop",
    browser: "Browser",
    defaultAlias: "Local Device",
  })

  const [alias, setAliasState] = useState("Local Device")
  const [requireShelfApproval, setRequireShelfApprovalState] = useState(false)
  const [autoAcceptOwnDevices, setAutoAcceptOwnDevicesState] = useState(true)
  const [myDevicesOnly, setMyDevicesOnly] = useState(false)

  const [selfPeerId, setSelfPeerId] = useState<string | null>(null)
  const [selfPeer, setSelfPeer] = useState<TesseractPeer | null>(null)
  const [selfDeviceId, setSelfDeviceId] = useState<string>("")
  const [selfTabId, setSelfTabId] = useState<string>("")
  const [peers, setPeers] = useState<TesseractPeer[]>([])
  const [transportState, setTransportState] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting")
  const [transportMode, setTransportMode] = useState<"ws" | "sse">("ws")

  const [peerDiagnostics, setPeerDiagnostics] = useState<
    Record<string, PeerConnectionDiagnostics>
  >({})
  const [sharedByYou, setSharedByYou] = useState<SharedLocalItem[]>([])
  const [remoteShelves, setRemoteShelves] = useState<
    Record<string, RemoteShelfItem[]>
  >({})
  const [transfers, setTransfers] = useState<TransferTask[]>([])
  const [pendingDirectOffers, setPendingDirectOffers] = useState<
    TesseractDirectOfferPayload[]
  >([])
  const [pendingShelfApprovals, setPendingShelfApprovals] = useState<
    IncomingShelfApprovalRequest[]
  >([])
  const [receivedDirectTexts, setReceivedDirectTexts] = useState<
    DirectReceivedTextNotification[]
  >([])

  // Refs to avoid stale closures across WebRTC & WebSocket callbacks
  const tRef = useRef(t)
  tRef.current = t
  const sharedByYouRef = useRef<SharedLocalItem[]>(sharedByYou)
  sharedByYouRef.current = sharedByYou
  const peersRef = useRef<TesseractPeer[]>(peers)
  peersRef.current = peers
  const isAuthenticatedRef = useRef(isAuthenticated)
  isAuthenticatedRef.current = isAuthenticated
  const currentUserIdRef = useRef(currentUserId)
  currentUserIdRef.current = currentUserId
  const requireShelfApprovalRef = useRef(requireShelfApproval)
  requireShelfApprovalRef.current = requireShelfApproval
  const autoAcceptOwnRef = useRef(autoAcceptOwnDevices)
  autoAcceptOwnRef.current = autoAcceptOwnDevices

  const selfPeerIdRef = useRef<string | null>(selfPeerId)
  selfPeerIdRef.current = selfPeerId
  const selfDeviceIdRef = useRef<string>(selfDeviceId)
  selfDeviceIdRef.current = selfDeviceId

  const fileLookupRef = useRef<Map<string, OutgoingTransferFileSpec>>(new Map())
  const pendingReceivePlansRef = useRef<Map<string, PendingReceivePlan>>(
    new Map()
  )
  const pendingOutgoingPullsRef = useRef<
    Map<string, PendingOutgoingPullData>
  >(new Map())
  const pendingOutgoingDirectRef = useRef<
    Map<string, PendingOutgoingDirectData>
  >(new Map())
  const speedTrackerRef = useRef<
    Map<string, { lastBytes: number; lastTime: number; ewmaSpeed: number }>
  >(new Map())

  const signalingRef = useRef<TesseractSignalingClient | null>(null)
  const meshRef = useRef<TesseractWebRtcMesh | null>(null)

  // Initialize device metadata, stable browser/tab IDs, and local preferences on mount
  useEffect(() => {
    const meta = detectDeviceMetadata()
    setDeviceInfo(meta)
    setSelfDeviceId(
      getOrCreateStorageId(
        typeof localStorage !== "undefined" ? localStorage : undefined,
        STORAGE_KEY_DEVICE_ID
      )
    )
    setSelfTabId(
      getOrCreateStorageId(
        typeof sessionStorage !== "undefined" ? sessionStorage : undefined,
        STORAGE_KEY_TAB_ID
      )
    )

    let resolvedAlias = meta.defaultAlias
    try {
      const savedAlias = localStorage.getItem(STORAGE_KEY_ALIAS)
      if (savedAlias && savedAlias.trim().length > 0) {
        resolvedAlias = savedAlias.trim().slice(0, 48)
      }
      const savedApproval = localStorage.getItem(STORAGE_KEY_APPROVAL)
      if (savedApproval === "true") setRequireShelfApprovalState(true)
      const savedAutoAccept = localStorage.getItem(STORAGE_KEY_AUTO_ACCEPT)
      if (savedAutoAccept === "false") setAutoAcceptOwnDevicesState(false)
    } catch {}
    setAliasState(resolvedAlias)

    setMounted(true)
  }, [])

  // If alias wasn't manually customized and user logs in, personalize default alias once
  useEffect(() => {
    if (!mounted) return
    try {
      const hasCustom = Boolean(localStorage.getItem(STORAGE_KEY_ALIAS))
      if (!hasCustom && user?.displayName) {
        const next = `${user.displayName}'s ${deviceInfo.os}`.slice(0, 48)
        setAliasState(next)
        signalingRef.current?.updateOptions({ alias: next })
        signalingRef.current?.send({ type: "peer:update", alias: next })
      }
    } catch {}
  }, [mounted, user?.displayName, deviceInfo.os])

  const upsertTransferTask = useCallback((task: TransferTask) => {
    setTransfers((prev) => {
      const idx = prev.findIndex((item) => item.id === task.id)
      if (idx === -1) return [task, ...prev]
      const copy = prev.slice()
      copy[idx] = task
      return copy
    })
  }, [])

  const patchTransferTask = useCallback(
    (transferId: string, updater: (prev: TransferTask) => TransferTask) => {
      setTransfers((prev) =>
        prev.map((item) => (item.id === transferId ? updater(item) : item))
      )
    },
    []
  )

  const getPeerAlias = useCallback((peerId: string) => {
    return (
      peersRef.current.find((p) => p.peerId === peerId)?.alias || "Local Peer"
    )
  }, [])

  // Build WebRTC mesh once on mount
  useEffect(() => {
    if (!mounted) return

    const mesh = new TesseractWebRtcMesh({
      sendSignal: (signal) => {
        signalingRef.current?.send(signal)
      },
      getLocalManifest: () => buildLocalManifest(sharedByYouRef.current),
      onPeerDiagnostics: (peerId, diag) => {
        setPeerDiagnostics((prev) => ({
          ...prev,
          [peerId]: diag,
        }))
      },
      onRemoteManifest: (peerId, items) => {
        setRemoteShelves((prev) => ({
          ...prev,
          [peerId]: items,
        }))
      },
      onPullRequest: (peerId, payload) => {
        const specs: OutgoingTransferFileSpec[] = []
        if (payload.fileIds && payload.fileIds.length > 0) {
          for (const fid of payload.fileIds) {
            const spec = fileLookupRef.current.get(fid)
            if (spec) specs.push(spec)
          }
        } else {
          for (const itemId of payload.itemIds) {
            const item = sharedByYouRef.current.find((s) => s.id === itemId)
            if (!item) continue
            if (item.kind === "file") {
              const spec = fileLookupRef.current.get(item.id)
              if (spec) specs.push(spec)
            } else if (item.kind === "folder") {
              for (const entry of item.files) {
                const spec = fileLookupRef.current.get(entry.id)
                if (spec) specs.push(spec)
              }
            }
          }
        }

        if (specs.length === 0) {
          mesh.sendControlMessage(peerId, {
            type: "pull:decision",
            transferId: payload.transferId,
            requestId: payload.requestId,
            accepted: false,
            reason: tRef.current("errors.itemsUnavailable"),
          })
          return
        }

        const totalBytes = specs.reduce((acc, s) => acc + s.size, 0)
        const summary = payload.itemNames.slice(0, 2).join(", ") || specs[0]!.name

        if (isAuthenticatedRef.current && requireShelfApprovalRef.current) {
          pendingOutgoingPullsRef.current.set(payload.requestId, {
            peerId,
            request: payload,
            fileSpecs: specs,
          })
          setPendingShelfApprovals((prev) => [
            ...prev,
            {
              requestId: payload.requestId,
              fromPeerId: peerId,
              fromAlias: getPeerAlias(peerId),
              itemNames: payload.itemNames,
              totalBytes,
              fileCount: specs.length,
            },
          ])
          return
        }

        mesh.sendControlMessage(peerId, {
          type: "pull:decision",
          transferId: payload.transferId,
          requestId: payload.requestId,
          accepted: true,
        })

        upsertTransferTask({
          id: payload.transferId,
          direction: "send",
          mode: "pull",
          peerId,
          peerAlias: getPeerAlias(peerId),
          itemsSummary: summary,
          fileCount: specs.length,
          totalBytes,
          transferredBytes: 0,
          speedBytesPerSec: 0,
          etaSeconds: null,
          status: "active",
          startedAt: Date.now(),
        })

        void mesh
          .sendFilesToPeer({
            transferId: payload.transferId,
            peerId,
            mode: "pull",
            files: specs,
          })
          .catch(() => {})
      },
      onPullDecision: (_peerId, payload: PullDecisionPayload) => {
        if (!payload.accepted) {
          pendingReceivePlansRef.current.delete(payload.transferId)
          patchTransferTask(payload.transferId, (prev) => ({
            ...prev,
            status: "declined",
            error: payload.reason || tRef.current("transfers.declined"),
            completedAt: Date.now(),
          }))
          toast.error(payload.reason || tRef.current("transfers.declined"))
          return
        }

        patchTransferTask(payload.transferId, (prev) => ({
          ...prev,
          status: "active",
        }))
      },
      onDirectTextDelivered: (peerId, payload) => {
        setReceivedDirectTexts((prev) => [
          {
            id: payload.transferId,
            fromAlias: getPeerAlias(peerId),
            items: payload.items,
            receivedAt: Date.now(),
          },
          ...prev,
        ])
        toast.success(
          tRef.current("toasts.directTextReceived", {
            peer: getPeerAlias(peerId),
          })
        )
      },
      createReceiverSink: async (meta) => {
        const plan = pendingReceivePlansRef.current.get(meta.transferId)
        pendingReceivePlansRef.current.delete(meta.transferId)

        if (plan?.saveMode === "directory" && plan.directoryHandle) {
          return {
            kind: "multi",
            sink: await createDirectoryWriterSink(plan.directoryHandle),
          }
        }

        if (plan?.saveMode === "zip" || meta.fileCount > 1) {
          return {
            kind: "multi",
            sink: await createStreamingZipSink({
              zipFilename: plan?.zipFilename || "tesseract-files.zip",
              preselectedHandle: plan?.fileHandle ?? null,
            }),
          }
        }

        return {
          kind: "single",
          sink: await createSingleFileSink({
            filename: meta.firstFileName,
            mimeType: meta.firstFileMimeType,
            preselectedHandle: plan?.fileHandle ?? null,
          }),
        }
      },
      onIncomingTransferStarted: (meta) => {
        patchTransferTask(meta.transferId, (prev) => ({
          ...prev,
          status: "active",
          totalBytes: meta.totalBytes,
          fileCount: meta.fileCount,
        }))
      },
      onTransferProgress: (transferId, transferredBytes, totalBytes) => {
        const now = Date.now()
        const tracker = speedTrackerRef.current.get(transferId)
        let ewmaSpeed = tracker?.ewmaSpeed ?? 0

        if (tracker) {
          const dt = (now - tracker.lastTime) / 1000
          const dBytes = transferredBytes - tracker.lastBytes
          if (dt >= 0.05 && dBytes >= 0) {
            const instant = dBytes / dt
            ewmaSpeed =
              ewmaSpeed > 0 ? 0.35 * instant + 0.65 * ewmaSpeed : instant
            speedTrackerRef.current.set(transferId, {
              lastBytes: transferredBytes,
              lastTime: now,
              ewmaSpeed,
            })
          }
        } else {
          speedTrackerRef.current.set(transferId, {
            lastBytes: transferredBytes,
            lastTime: now,
            ewmaSpeed: 0,
          })
        }

        const remaining = Math.max(0, totalBytes - transferredBytes)
        const eta = ewmaSpeed > 1 ? remaining / ewmaSpeed : null

        patchTransferTask(transferId, (prev) => ({
          ...prev,
          transferredBytes,
          totalBytes: totalBytes || prev.totalBytes,
          speedBytesPerSec: ewmaSpeed,
          etaSeconds: eta,
        }))
      },
      onTransferCompleted: (transferId) => {
        speedTrackerRef.current.delete(transferId)
        patchTransferTask(transferId, (prev) => ({
          ...prev,
          status: "completed",
          transferredBytes: prev.totalBytes,
          etaSeconds: 0,
          completedAt: Date.now(),
        }))
        toast.success(tRef.current("toasts.transferCompleted"))
      },
      onTransferFailed: (transferId, reason, cancelled) => {
        speedTrackerRef.current.delete(transferId)
        pendingReceivePlansRef.current.delete(transferId)
        patchTransferTask(transferId, (prev) => ({
          ...prev,
          status: cancelled ? "cancelled" : "failed",
          error: reason,
          completedAt: Date.now(),
        }))
        if (!cancelled) {
          toast.error(reason || tRef.current("toasts.transferFailed"))
        }
      },
    })

    meshRef.current = mesh
    return () => {
      mesh.destroy()
      meshRef.current = null
    }
  }, [mounted, getPeerAlias, patchTransferTask, upsertTransferTask])

  // Broadcast updated local shelf manifest whenever sharedByYou changes
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.broadcastManifest(buildLocalManifest(sharedByYou))
  }, [sharedByYou])

  const isSameDevicePeer = useCallback((peer: TesseractPeer): boolean => {
    if (selfPeerIdRef.current && peer.peerId === selfPeerIdRef.current) {
      return true
    }
    if (
      selfDeviceIdRef.current &&
      peer.deviceId &&
      peer.deviceId === selfDeviceIdRef.current
    ) {
      return true
    }
    return false
  }, [])

  const handleServerEvent = useCallback(
    (event: TesseractServerEvent) => {
      const mesh = meshRef.current

      switch (event.event) {
        case "room:joined": {
          const {
            selfPeerId: nextSelfId,
            selfPeer: nextSelf,
            peers: peerList,
          } = event.data

          selfPeerIdRef.current = nextSelfId
          setSelfPeerId(nextSelfId)
          setSelfPeer(nextSelf)
          const visiblePeers = peerList.filter(
            (p) =>
              p.peerId !== nextSelfId &&
              !(
                selfDeviceIdRef.current &&
                p.deviceId &&
                p.deviceId === selfDeviceIdRef.current
              )
          )
          setPeers(visiblePeers)
          setRemoteShelves({})
          setPeerDiagnostics({})

          if (mesh) {
            mesh.resetAllPeers()
            mesh.setSelfPeerId(nextSelfId)
            for (const peer of visiblePeers) {
              mesh.ensurePeerConnection(peer.peerId, false)
            }
          }
          break
        }

        case "peer:joined": {
          const joinedPeer = event.data.peer
          if (isSameDevicePeer(joinedPeer)) break
          setPeers((prev) => {
            const exists = prev.some((p) => p.peerId === joinedPeer.peerId)
            return exists
              ? prev.map((p) =>
                  p.peerId === joinedPeer.peerId ? joinedPeer : p
                )
              : [...prev, joinedPeer]
          })
          mesh?.ensurePeerConnection(joinedPeer.peerId, false)
          break
        }

        case "peer:updated": {
          const updated = event.data.peer
          if (isSameDevicePeer(updated)) break
          setPeers((prev) =>
            prev.map((p) => (p.peerId === updated.peerId ? updated : p))
          )
          break
        }

        case "peer:left": {
          const leftPeerId = event.data.peerId
          setPeers((prev) => prev.filter((p) => p.peerId !== leftPeerId))
          setRemoteShelves((prev) => {
            const next = { ...prev }
            delete next[leftPeerId]
            return next
          })
          setPeerDiagnostics((prev) => {
            const next = { ...prev }
            delete next[leftPeerId]
            return next
          })
          setPendingDirectOffers((prev) =>
            prev.filter((o) => o.fromPeerId !== leftPeerId)
          )
          setPendingShelfApprovals((prev) =>
            prev.filter((r) => r.fromPeerId !== leftPeerId)
          )
          mesh?.removePeer(leftPeerId)
          break
        }

        case "rtc:offer":
          void mesh?.handleOfferSignal(event.data.fromPeerId, event.data.sdp)
          break

        case "rtc:answer":
          void mesh?.handleAnswerSignal(event.data.fromPeerId, event.data.sdp)
          break

        case "rtc:ice":
          void mesh?.handleIceSignal(
            event.data.fromPeerId,
            event.data.candidate
          )
          break

        case "direct:offer": {
          const offer = event.data
          if (!isAuthenticatedRef.current) {
            signalingRef.current?.send({
              type: "direct:response",
              toPeerId: offer.fromPeerId,
              offerId: offer.offerId,
              accepted: false,
              reason: tRef.current("errors.directRequiresAccount"),
            })
            return
          }

          const sameAccount =
            Boolean(offer.fromUserId) &&
            Boolean(currentUserIdRef.current) &&
            offer.fromUserId === currentUserIdRef.current

          if (sameAccount && autoAcceptOwnRef.current) {
            const hasMultiple =
              offer.items.some((i) => i.kind === "folder") ||
              offer.items.filter((i) => i.kind !== "text").length > 1
            const fileItems = offer.items.filter((i) => i.kind !== "text")

            if (fileItems.length > 0) {
              pendingReceivePlansRef.current.set(offer.offerId, {
                saveMode: hasMultiple ? "zip" : "auto",
                zipFilename: `${fileItems[0]!.name || "tesseract-transfer"}.zip`,
                fileHandle: null,
                directoryHandle: null,
              })

              upsertTransferTask({
                id: offer.offerId,
                direction: "receive",
                mode: "direct",
                peerId: offer.fromPeerId,
                peerAlias: offer.fromAlias,
                itemsSummary:
                  fileItems.map((i) => i.name).slice(0, 2).join(", ") ||
                  "Direct Transfer",
                fileCount: fileItems.reduce(
                  (acc, i) => acc + (i.fileCount ?? 1),
                  0
                ),
                totalBytes: offer.totalBytes,
                transferredBytes: 0,
                speedBytesPerSec: 0,
                etaSeconds: null,
                status: "active",
                startedAt: Date.now(),
              })
            }

            signalingRef.current?.send({
              type: "direct:response",
              toPeerId: offer.fromPeerId,
              offerId: offer.offerId,
              accepted: true,
              autoAccepted: true,
            })

            toast.info(
              tRef.current("toasts.autoAcceptedOwnDevice", {
                peer: offer.fromAlias,
              })
            )
            return
          }

          setPendingDirectOffers((prev) => [...prev, offer])
          break
        }

        case "direct:response": {
          const res = event.data
          const pending = pendingOutgoingDirectRef.current.get(res.offerId)
          if (!pending) return
          pendingOutgoingDirectRef.current.delete(res.offerId)

          if (!res.accepted) {
            patchTransferTask(res.offerId, (prev) => ({
              ...prev,
              status: "declined",
              error: res.reason || tRef.current("transfers.declined"),
              completedAt: Date.now(),
            }))
            toast.error(res.reason || tRef.current("transfers.declined"))
            return
          }

          if (pending.textItems.length > 0 && mesh) {
            void mesh.waitForPeerConnected(pending.peerId).then(() => {
              mesh.sendControlMessage(pending.peerId, {
                type: "direct:text",
                transferId: res.offerId,
                items: pending.textItems,
              })
            })
          }

          if (pending.fileSpecs.length === 0) {
            patchTransferTask(res.offerId, (prev) => ({
              ...prev,
              status: "completed",
              completedAt: Date.now(),
            }))
            toast.success(tRef.current("toasts.transferCompleted"))
            return
          }

          patchTransferTask(res.offerId, (prev) => ({
            ...prev,
            status: "active",
          }))

          if (mesh) {
            void mesh
              .sendFilesToPeer({
                transferId: res.offerId,
                peerId: pending.peerId,
                mode: "direct",
                files: pending.fileSpecs,
              })
              .catch(() => {})
          }
          break
        }

        case "room:error": {
          toast.error(event.data.message)
          break
        }
      }
    },
    [isSameDevicePeer, patchTransferTask, upsertTransferTask]
  )

  const handleServerEventRef = useRef(handleServerEvent)
  handleServerEventRef.current = handleServerEvent

  // Connect signaling when mounted and session finishes initial resolution
  useEffect(() => {
    if (!mounted || sessionStatus === "loading" || !selfDeviceId || !selfTabId) {
      return
    }

    const client = new TesseractSignalingClient({
      deviceId: selfDeviceId,
      tabId: selfTabId,
      alias,
      deviceType: deviceInfo.deviceType,
      os: deviceInfo.os,
      browser: deviceInfo.browser,
      requireShelfApproval: isAuthenticated ? requireShelfApproval : false,
      onEvent: (ev) => handleServerEventRef.current(ev),
      onTransportState: (state, mode) => {
        setTransportState(state)
        setTransportMode(mode)
      },
    })

    signalingRef.current = client
    client.connect()

    const handleBeforeUnload = () => {
      client.sendUnloadLeave()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      client.disconnect()
      if (signalingRef.current === client) {
        signalingRef.current = null
      }
    }
    // Reconnect signaling cleanly on auth/device metadata change; live alias/approval changes use peer:update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mounted,
    sessionStatus,
    currentUserId,
    selfDeviceId,
    selfTabId,
    deviceInfo.deviceType,
    deviceInfo.os,
    deviceInfo.browser,
  ])

  const setAlias = useCallback((nextAlias: string) => {
    const cleaned = nextAlias.trim().slice(0, 48)
    if (!cleaned) return
    setAliasState(cleaned)
    try {
      localStorage.setItem(STORAGE_KEY_ALIAS, cleaned)
    } catch {}
    signalingRef.current?.updateOptions({ alias: cleaned })
    signalingRef.current?.send({ type: "peer:update", alias: cleaned })
    setSelfPeer((prev) => (prev ? { ...prev, alias: cleaned } : prev))
  }, [])

  const setRequireShelfApproval = useCallback((enabled: boolean) => {
    if (!isAuthenticatedRef.current) {
      toast.info(tRef.current("errors.loginRequiredFeature"))
      return
    }
    setRequireShelfApprovalState(enabled)
    try {
      localStorage.setItem(STORAGE_KEY_APPROVAL, enabled ? "true" : "false")
    } catch {}
    signalingRef.current?.updateOptions({ requireShelfApproval: enabled })
    signalingRef.current?.send({
      type: "peer:update",
      requireShelfApproval: enabled,
    })
  }, [])

  const setAutoAcceptOwnDevices = useCallback((enabled: boolean) => {
    setAutoAcceptOwnDevicesState(enabled)
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_ACCEPT, enabled ? "true" : "false")
    } catch {}
  }, [])

  const addFilesToShelf = useCallback((files: File[]) => {
    if (files.length === 0) return
    const nextItems: SharedLocalItem[] = files.map((file) => {
      const id = crypto.randomUUID()
      fileLookupRef.current.set(id, {
        fileId: id,
        name: file.name,
        relativePath: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        file,
      })
      return {
        id,
        kind: "file",
        name: file.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        lastModified: file.lastModified,
        file,
      }
    })
    setSharedByYou((prev) => [...nextItems, ...prev])
  }, [])

  const addFoldersToShelf = useCallback((folders: DroppedFolderSpec[]) => {
    if (folders.length === 0) return
    if (!isAuthenticatedRef.current) {
      toast.info(tRef.current("errors.folderRequiresAccount"))
      return
    }

    const nextItems: SharedLocalItem[] = []
    for (const folder of folders) {
      if (folder.files.length === 0) continue
      const entries: SharedLocalFileEntry[] = folder.files.map((f) => {
        const entryId = crypto.randomUUID()
        fileLookupRef.current.set(entryId, {
          fileId: entryId,
          name: f.file.name,
          relativePath: f.relativePath,
          size: f.file.size,
          mimeType: f.file.type || "application/octet-stream",
          file: f.file,
        })
        return {
          id: entryId,
          relativePath: f.relativePath,
          name: f.file.name,
          size: f.file.size,
          mimeType: f.file.type || "application/octet-stream",
          lastModified: f.file.lastModified,
          file: f.file,
        }
      })

      const totalSize = entries.reduce((acc, e) => acc + e.size, 0)
      nextItems.push({
        id: crypto.randomUUID(),
        kind: "folder",
        name: folder.name,
        totalSize,
        fileCount: entries.length,
        files: entries,
      })
    }

    if (nextItems.length > 0) {
      setSharedByYou((prev) => [...nextItems, ...prev])
    }
  }, [])

  const addTextToShelf = useCallback((content: string, title?: string) => {
    const trimmed = content.trim()
    if (!trimmed) return
    const nextItem: SharedLocalItem = {
      id: crypto.randomUUID(),
      kind: "text",
      title: title?.trim() || undefined,
      content: trimmed,
      isUrl: isLikelyUrl(trimmed),
      createdAt: Date.now(),
    }
    setSharedByYou((prev) => [nextItem, ...prev])
  }, [])

  const removeLocalItem = useCallback((itemId: string) => {
    setSharedByYou((prev) => {
      const target = prev.find((i) => i.id === itemId)
      if (target) {
        if (target.kind === "file") {
          fileLookupRef.current.delete(target.id)
        } else if (target.kind === "folder") {
          for (const entry of target.files) {
            fileLookupRef.current.delete(entry.id)
          }
        }
      }
      return prev.filter((i) => i.id !== itemId)
    })
  }, [])

  const clearLocalShelf = useCallback(() => {
    fileLookupRef.current.clear()
    setSharedByYou([])
  }, [])

  const handleDataTransferDropOrPaste = useCallback(
    async (
      dataTransfer: DataTransfer,
      source: "drop" | "paste" = "drop"
    ): Promise<boolean> => {
      const { extractDroppedDataTransfer } = await import(
        "@/lib/tesseract/device-info"
      )
      const extracted = await extractDroppedDataTransfer(dataTransfer)
      let added = false

      if (extracted.folders.length > 0) {
        addFoldersToShelf(extracted.folders)
        if (isAuthenticatedRef.current) added = true
      }

      if (extracted.files.length > 0) {
        const processedFiles = extracted.files.map((file) => {
          if (
            source === "paste" &&
            file.name === "image.png" &&
            file.type.startsWith("image/")
          ) {
            const stamp = new Date()
              .toTimeString()
              .slice(0, 8)
              .replace(/:/g, "")
            return new File([file], `clipboard-${stamp}.png`, {
              type: file.type,
              lastModified: file.lastModified,
            })
          }
          return file
        })
        addFilesToShelf(processedFiles)
        added = true
      }

      if (extracted.text) {
        addTextToShelf(extracted.text)
        added = true
      }

      return added
    },
    [addFilesToShelf, addFoldersToShelf, addTextToShelf]
  )

  // Global Ctrl+V clipboard paste support (outside editable inputs/textareas)
  useEffect(() => {
    if (!mounted) return
    const onPaste = (ev: ClipboardEvent) => {
      const active = document.activeElement
      const tag = active?.tagName?.toLowerCase()
      const isEditable =
        tag === "input" ||
        tag === "textarea" ||
        (active as HTMLElement | null)?.isContentEditable
      if (isEditable) return

      if (ev.clipboardData) {
        void handleDataTransferDropOrPaste(ev.clipboardData, "paste").then(
          (didAdd) => {
            if (didAdd) {
              toast.success(tRef.current("toasts.pastedToShelf"))
            }
          }
        )
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [mounted, handleDataTransferDropOrPaste])

  const pullItemsFromPeer = useCallback(
    async (options: {
      peerId: string
      itemIds: string[]
      fileIds?: string[]
      saveMode?: "auto" | "zip" | "directory"
      summaryName: string
      fileCount: number
      totalBytes: number
      singleFileName?: string
    }) => {
      const mesh = meshRef.current
      if (!mesh) return

      const transferId = crypto.randomUUID()
      const requestId = crypto.randomUUID()
      const resolvedMode =
        options.saveMode ?? (options.fileCount > 1 ? "zip" : "auto")

      let fileHandle: FileSystemFileHandle | null = null
      let directoryHandle: FileSystemDirectoryHandle | null = null
      const zipFilename = `${options.summaryName || "tesseract-download"}.zip`

      try {
        if (resolvedMode === "directory") {
          directoryHandle = await pickTargetDirectoryHandle()
          if (!directoryHandle) {
            toast.error(tRef.current("errors.directoryPickerUnsupported"))
            return
          }
        } else if (resolvedMode === "zip" || options.fileCount > 1) {
          if (supportsSaveFilePicker()) {
            fileHandle = await pickSaveFileHandle(zipFilename)
          }
        } else if (options.singleFileName && supportsSaveFilePicker()) {
          fileHandle = await pickSaveFileHandle(options.singleFileName)
        }
      } catch (err) {
        if (err instanceof UserCancelledSaveError) return
      }

      pendingReceivePlansRef.current.set(transferId, {
        saveMode: resolvedMode,
        zipFilename,
        fileHandle,
        directoryHandle,
      })

      const targetPeer = peersRef.current.find(
        (p) => p.peerId === options.peerId
      )

      upsertTransferTask({
        id: transferId,
        direction: "receive",
        mode: "pull",
        peerId: options.peerId,
        peerAlias: targetPeer?.alias || "Local Peer",
        itemsSummary: options.summaryName,
        fileCount: options.fileCount,
        totalBytes: options.totalBytes,
        transferredBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: null,
        status: targetPeer?.requireShelfApproval
          ? "pending-approval"
          : "active",
        startedAt: Date.now(),
      })

      try {
        await mesh.waitForPeerConnected(options.peerId)
        mesh.sendControlMessage(options.peerId, {
          type: "pull:request",
          transferId,
          requestId,
          itemIds: options.itemIds,
          fileIds: options.fileIds,
          itemNames: [options.summaryName],
          fileCount: options.fileCount,
          totalBytes: options.totalBytes,
        })
      } catch (err) {
        pendingReceivePlansRef.current.delete(transferId)
        patchTransferTask(transferId, (prev) => ({
          ...prev,
          status: "failed",
          error:
            err instanceof Error
              ? err.message
              : tRef.current("toasts.transferFailed"),
          completedAt: Date.now(),
        }))
        toast.error(
          err instanceof Error
            ? err.message
            : tRef.current("toasts.transferFailed")
        )
      }
    },
    [patchTransferTask, upsertTransferTask]
  )

  const sendDirectToPeer = useCallback(
    async (options: {
      peerId: string
      files: File[]
      folders: DroppedFolderSpec[]
      texts: Array<{ content: string; title?: string }>
    }): Promise<boolean> => {
      if (!isAuthenticatedRef.current) {
        toast.info(tRef.current("errors.directRequiresAccount"))
        return false
      }

      const targetPeer = peersRef.current.find(
        (p) => p.peerId === options.peerId
      )
      if (!targetPeer) {
        toast.error(tRef.current("errors.peerDisconnected"))
        return false
      }
      if (!targetPeer.isAuthenticated) {
        toast.error(tRef.current("errors.recipientGuestNoDirect"))
        return false
      }

      const offerId = crypto.randomUUID()
      const fileSpecs: OutgoingTransferFileSpec[] = []
      const metaInputs: Parameters<typeof buildTransferItemMetaList>[0] = []

      for (const file of options.files) {
        const fid = crypto.randomUUID()
        fileSpecs.push({
          fileId: fid,
          name: file.name,
          relativePath: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          file,
        })
        metaInputs.push({
          id: fid,
          kind: "file",
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        })
      }

      for (const folder of options.folders) {
        let folderSize = 0
        for (const entry of folder.files) {
          folderSize += entry.file.size
          fileSpecs.push({
            fileId: crypto.randomUUID(),
            name: entry.file.name,
            relativePath: entry.relativePath,
            size: entry.file.size,
            mimeType: entry.file.type || "application/octet-stream",
            file: entry.file,
          })
        }
        metaInputs.push({
          id: crypto.randomUUID(),
          kind: "folder",
          name: folder.name,
          totalSize: folderSize,
          fileCount: folder.files.length,
        })
      }

      const textItems: DirectTextDeliverPayload["items"] = options.texts
        .map((txt) => ({
          id: crypto.randomUUID(),
          title: txt.title?.trim() || undefined,
          content: txt.content.trim(),
          isUrl: isLikelyUrl(txt.content.trim()),
          createdAt: Date.now(),
        }))
        .filter((txt) => txt.content.length > 0)

      for (const txt of textItems) {
        metaInputs.push({
          id: txt.id,
          kind: "text",
          content: txt.content,
        })
      }

      if (fileSpecs.length === 0 && textItems.length === 0) {
        return false
      }

      const itemsMeta = buildTransferItemMetaList(metaInputs)
      const totalBytes = fileSpecs.reduce((acc, f) => acc + f.size, 0)
      const summaryName =
        itemsMeta
          .map((i) => i.name)
          .slice(0, 2)
          .join(", ") || "Direct Transfer"

      pendingOutgoingDirectRef.current.set(offerId, {
        peerId: options.peerId,
        fileSpecs,
        textItems,
        totalBytes,
        fileCount: fileSpecs.length,
        summaryName,
      })

      upsertTransferTask({
        id: offerId,
        direction: "send",
        mode: "direct",
        peerId: options.peerId,
        peerAlias: targetPeer.alias,
        itemsSummary: summaryName,
        fileCount: fileSpecs.length,
        totalBytes,
        transferredBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: null,
        status: "pending-approval",
        startedAt: Date.now(),
      })

      signalingRef.current?.send({
        type: "direct:offer",
        toPeerId: options.peerId,
        offerId,
        items: itemsMeta,
        totalBytes,
      })

      return true
    },
    [upsertTransferTask]
  )

  const respondToDirectOffer = useCallback(
    async (
      offerId: string,
      accepted: boolean,
      saveMode: "auto" | "zip" | "directory" = "auto"
    ) => {
      const offer = pendingDirectOffers.find((o) => o.offerId === offerId)
      if (!offer) return

      const fileItems = offer.items.filter((i) => i.kind !== "text")
      const hasFolders = offer.items.some((i) => i.kind === "folder")

      if (!accepted) {
        setPendingDirectOffers((prev) =>
          prev.filter((o) => o.offerId !== offerId)
        )
        signalingRef.current?.send({
          type: "direct:response",
          toPeerId: offer.fromPeerId,
          offerId: offer.offerId,
          accepted: false,
          reason: tRef.current("transfers.declinedByRecipient"),
        })
        return
      }

      if (fileItems.length > 0) {
        let fileHandle: FileSystemFileHandle | null = null
        let directoryHandle: FileSystemDirectoryHandle | null = null
        const resolvedMode =
          saveMode === "directory"
            ? "directory"
            : hasFolders || fileItems.length > 1 || saveMode === "zip"
              ? "zip"
              : "auto"
        const firstFileName = fileItems[0]?.name || "tesseract-download"
        const zipFilename = `${firstFileName}.zip`

        try {
          if (resolvedMode === "directory") {
            directoryHandle = await pickTargetDirectoryHandle()
            if (!directoryHandle) {
              toast.error(tRef.current("errors.directoryPickerUnsupported"))
              return
            }
          } else if (resolvedMode === "zip" && supportsSaveFilePicker()) {
            fileHandle = await pickSaveFileHandle(zipFilename)
          } else if (supportsSaveFilePicker()) {
            fileHandle = await pickSaveFileHandle(firstFileName)
          }
        } catch (err) {
          if (err instanceof UserCancelledSaveError) return
        }

        pendingReceivePlansRef.current.set(offer.offerId, {
          saveMode: resolvedMode,
          zipFilename,
          fileHandle,
          directoryHandle,
        })

        upsertTransferTask({
          id: offer.offerId,
          direction: "receive",
          mode: "direct",
          peerId: offer.fromPeerId,
          peerAlias: offer.fromAlias,
          itemsSummary: fileItems.map((i) => i.name).slice(0, 2).join(", "),
          fileCount: fileItems.reduce((acc, i) => acc + (i.fileCount ?? 1), 0),
          totalBytes: offer.totalBytes,
          transferredBytes: 0,
          speedBytesPerSec: 0,
          etaSeconds: null,
          status: "active",
          startedAt: Date.now(),
        })
      }

      setPendingDirectOffers((prev) =>
        prev.filter((o) => o.offerId !== offerId)
      )

      signalingRef.current?.send({
        type: "direct:response",
        toPeerId: offer.fromPeerId,
        offerId: offer.offerId,
        accepted: true,
      })
    },
    [pendingDirectOffers, upsertTransferTask]
  )

  const respondToShelfApproval = useCallback(
    (requestId: string, approved: boolean) => {
      setPendingShelfApprovals((prev) =>
        prev.filter((r) => r.requestId !== requestId)
      )
      const pending = pendingOutgoingPullsRef.current.get(requestId)
      if (!pending) return
      pendingOutgoingPullsRef.current.delete(requestId)

      const mesh = meshRef.current
      if (!mesh) return

      mesh.sendControlMessage(pending.peerId, {
        type: "pull:decision",
        transferId: pending.request.transferId,
        requestId,
        accepted: approved,
        reason: approved ? undefined : tRef.current("transfers.declined"),
      })

      if (!approved) return

      const totalBytes = pending.fileSpecs.reduce((acc, s) => acc + s.size, 0)
      upsertTransferTask({
        id: pending.request.transferId,
        direction: "send",
        mode: "pull",
        peerId: pending.peerId,
        peerAlias: getPeerAlias(pending.peerId),
        itemsSummary:
          pending.request.itemNames.slice(0, 2).join(", ") ||
          pending.fileSpecs[0]!.name,
        fileCount: pending.fileSpecs.length,
        totalBytes,
        transferredBytes: 0,
        speedBytesPerSec: 0,
        etaSeconds: null,
        status: "active",
        startedAt: Date.now(),
      })

      void mesh
        .sendFilesToPeer({
          transferId: pending.request.transferId,
          peerId: pending.peerId,
          mode: "pull",
          files: pending.fileSpecs,
        })
        .catch(() => {})
    },
    [getPeerAlias, upsertTransferTask]
  )

  const cancelTransfer = useCallback(
    (transferId: string) => {
      pendingOutgoingDirectRef.current.delete(transferId)
      pendingReceivePlansRef.current.delete(transferId)
      const target = transfers.find((item) => item.id === transferId)
      meshRef.current?.cancelTransfer(
        transferId,
        target?.peerId,
        tRef.current("transfers.cancelledByUser")
      )
      patchTransferTask(transferId, (prev) => ({
        ...prev,
        status: "cancelled",
        error: tRef.current("transfers.cancelledByUser"),
        completedAt: Date.now(),
      }))
    },
    [patchTransferTask, transfers]
  )

  const clearCompletedTransfers = useCallback(() => {
    setTransfers((prev) =>
      prev.filter(
        (item) => item.status === "active" || item.status === "pending-approval"
      )
    )
  }, [])

  const retryPeerConnection = useCallback((peerId: string) => {
    meshRef.current?.retryPeer(peerId)
  }, [])

  const dismissReceivedDirectText = useCallback((id: string) => {
    setReceivedDirectTexts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const visiblePeers = useMemo(
    () => peers.filter((p) => !isSameDevicePeer(p)),
    [peers, isSameDevicePeer]
  )

  const filteredPeers = useMemo(() => {
    if (!myDevicesOnly || !currentUserId) return visiblePeers
    return visiblePeers.filter((p) => p.user?.id === currentUserId)
  }, [visiblePeers, myDevicesOnly, currentUserId])

  const value = useMemo<TesseractContextValue>(
    () => ({
      mounted,
      isAuthenticated,
      currentUserId,
      selfPeerId,
      selfPeer,
      transportState,
      transportMode,
      alias,
      setAlias,
      requireShelfApproval,
      setRequireShelfApproval,
      autoAcceptOwnDevices,
      setAutoAcceptOwnDevices,
      myDevicesOnly,
      setMyDevicesOnly,
      peers: visiblePeers,
      filteredPeers,
      peerDiagnostics,
      sharedByYou,
      remoteShelves,
      transfers,
      receivedDirectTexts,
      dismissReceivedDirectText,
      pendingDirectOffers,
      pendingShelfApprovals,
      retryPeerConnection,
      addFilesToShelf,
      addFoldersToShelf,
      addTextToShelf,
      removeLocalItem,
      clearLocalShelf,
      handleDataTransferDropOrPaste,
      pullItemsFromPeer,
      sendDirectToPeer,
      respondToDirectOffer,
      respondToShelfApproval,
      cancelTransfer,
      clearCompletedTransfers,
      deviceInfo: {
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
      },
    }),
    [
      mounted,
      isAuthenticated,
      currentUserId,
      selfPeerId,
      selfPeer,
      transportState,
      transportMode,
      alias,
      setAlias,
      requireShelfApproval,
      setRequireShelfApproval,
      autoAcceptOwnDevices,
      setAutoAcceptOwnDevices,
      myDevicesOnly,
      visiblePeers,
      filteredPeers,
      peerDiagnostics,
      sharedByYou,
      remoteShelves,
      transfers,
      receivedDirectTexts,
      dismissReceivedDirectText,
      pendingDirectOffers,
      pendingShelfApprovals,
      retryPeerConnection,
      addFilesToShelf,
      addFoldersToShelf,
      addTextToShelf,
      removeLocalItem,
      clearLocalShelf,
      handleDataTransferDropOrPaste,
      pullItemsFromPeer,
      sendDirectToPeer,
      respondToDirectOffer,
      respondToShelfApproval,
      cancelTransfer,
      clearCompletedTransfers,
      deviceInfo.deviceType,
      deviceInfo.os,
      deviceInfo.browser,
    ]
  )

  return (
    <TesseractContext.Provider value={value}>
      {children}
    </TesseractContext.Provider>
  )
}

export function useTesseract(): TesseractContextValue {
  const ctx = useContext(TesseractContext)
  if (!ctx) {
    throw new Error("useTesseract must be used within a TesseractProvider")
  }
  return ctx
}
