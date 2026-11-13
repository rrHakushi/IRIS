import type {
  TesseractClientSignal,
  TesseractTransferItemMeta,
} from "@NamelessLiberty/shared"
import type {
  OutgoingTransferFileSpec,
  PeerConnectionDiagnostics,
  RemoteShelfItem,
} from "./types"
import type { MultiFileReceiverSink, BinaryByteSink } from "./download-writer"

const CHUNK_SIZE = 64 * 1024 // 64 KB SCTP-safe chunk size
const HIGH_WATER_MARK = 1024 * 1024 // 1 MB backpressure high-water mark
const LOW_WATER_THRESHOLD = 256 * 1024 // 256 KB resume threshold
const UNREACHABLE_TIMEOUT_MS = 10_000

// Strict local-network-only WebRTC config: zero STUN/TURN servers
const HOST_ONLY_RTC_CONFIG: RTCConfiguration = {
  iceServers: [],
  iceCandidatePoolSize: 0,
}

export interface PullRequestPayload {
  type: "pull:request"
  transferId: string
  requestId: string
  itemIds: string[]
  fileIds?: string[]
  itemNames: string[]
  fileCount: number
  totalBytes: number
}

export interface PullDecisionPayload {
  type: "pull:decision"
  transferId: string
  requestId: string
  accepted: boolean
  reason?: string
}

export interface DirectTextDeliverPayload {
  type: "direct:text"
  transferId: string
  items: Array<{
    id: string
    title?: string
    content: string
    isUrl: boolean
    createdAt: number
  }>
}

type ControlMessage =
  | { type: "shelf:manifest"; items: RemoteShelfItem[] }
  | PullRequestPayload
  | PullDecisionPayload
  | DirectTextDeliverPayload
  | { type: "xfer:cancel"; transferId: string; reason?: string }
  | { type: "xfer:ack"; transferId: string }

type XferFrameHeader =
  | {
      type: "xfer:start"
      transferId: string
      mode: "pull" | "direct"
      fileCount: number
      totalBytes: number
    }
  | {
      type: "file:start"
      index: number
      fileId: string
      name: string
      relativePath: string
      size: number
      mimeType: string
    }
  | { type: "file:end"; index: number }
  | { type: "xfer:end" }
  | { type: "xfer:cancel"; reason?: string }

export type IncomingReceiverSinkFactory = (meta: {
  transferId: string
  peerId: string
  mode: "pull" | "direct"
  fileCount: number
  totalBytes: number
  firstFileName: string
  firstFileMimeType: string
}) => Promise<
  | { kind: "single"; sink: BinaryByteSink }
  | { kind: "multi"; sink: MultiFileReceiverSink }
>

export interface WebRtcMeshCallbacks {
  sendSignal: (signal: TesseractClientSignal) => void
  getLocalManifest: () => RemoteShelfItem[]
  onPeerDiagnostics: (peerId: string, diag: PeerConnectionDiagnostics) => void
  onRemoteManifest: (peerId: string, items: RemoteShelfItem[]) => void
  onPullRequest: (peerId: string, payload: PullRequestPayload) => void
  onPullDecision: (peerId: string, payload: PullDecisionPayload) => void
  onDirectTextDelivered: (
    peerId: string,
    payload: DirectTextDeliverPayload
  ) => void
  createReceiverSink: IncomingReceiverSinkFactory
  onIncomingTransferStarted?: (meta: {
    transferId: string
    peerId: string
    mode: "pull" | "direct"
    fileCount: number
    totalBytes: number
  }) => void
  onTransferProgress: (
    transferId: string,
    transferredBytes: number,
    totalBytes: number
  ) => void
  onTransferCompleted: (transferId: string) => void
  onTransferFailed: (transferId: string, reason: string, cancelled?: boolean) => void
}

interface OutgoingSendControl {
  peerId: string
  cancelled: boolean
  cancelReason?: string
  channel: RTCDataChannel | null
  ackResolve?: () => void
  ackTimeout?: ReturnType<typeof setTimeout>
}

interface IncomingReceiveState {
  transferId: string
  peerId: string
  cancelled: boolean
  mode: "pull" | "direct"
  fileCount: number
  totalBytes: number
  transferredBytes: number
  lastProgressEmitAt: number
  sinkKind: "single" | "multi" | null
  singleSink: BinaryByteSink | null
  multiSink: MultiFileReceiverSink | null
  currentFileSize: number
  currentFileReceived: number
  channel: RTCDataChannel
  chain: Promise<void>
}

interface PeerSlot {
  peerId: string
  pc: RTCPeerConnection
  ctrlChannel: RTCDataChannel | null
  ctrlQueue: string[]
  pendingCandidates: RTCIceCandidateInit[]
  lastRemoteSessionId: string | null
  makingOffer: boolean
  ignoreOffer: boolean
  unreachableTimer: ReturnType<typeof setTimeout> | null
  diagnostics: PeerConnectionDiagnostics
}

function extractSdpSessionId(sdp: unknown): string | null {
  if (!sdp || typeof sdp !== "object") return null
  const raw = (sdp as { sdp?: unknown }).sdp
  if (typeof raw !== "string") return null
  const match = raw.match(/^o=\S+\s+(\S+)\s+/m)
  return match ? match[1]! : null
}

function sanitizeDiagnosticCandidate(type?: string, protocol?: string): string {
  const parts = ["host"]
  if (type && type !== "host") parts[0] = type
  if (protocol) parts.push(protocol.toLowerCase())
  return parts.join(" · ")
}

export class TesseractWebRtcMesh {
  private selfPeerId: string | null = null
  private peers = new Map<string, PeerSlot>()
  private outgoing = new Map<string, OutgoingSendControl>()
  private incoming = new Map<string, IncomingReceiveState>()
  private destroyed = false
  private callbacks: WebRtcMeshCallbacks

  constructor(callbacks: WebRtcMeshCallbacks) {
    this.callbacks = callbacks
  }

  public setSelfPeerId(peerId: string | null): void {
    this.selfPeerId = peerId
  }

  public ensurePeerConnection(peerId: string, forceRestart = false): void {
    if (this.destroyed || !this.selfPeerId || peerId === this.selfPeerId) return

    const existing = this.peers.get(peerId)
    if (existing && !forceRestart) {
      const state = existing.pc.connectionState
      if (state !== "closed" && state !== "failed") {
        return
      }
    }

    if (existing) {
      this.teardownPeerSlot(existing, "Connection restarted")
      this.peers.delete(peerId)
    }

    const slot = this.createPeerSlot(peerId)
    this.peers.set(peerId, slot)

    const shouldInitiate = forceRestart || this.selfPeerId < peerId
    if (shouldInitiate) {
      const ctrl = slot.pc.createDataChannel("tesseract-ctrl", { ordered: true })
      this.attachControlChannel(slot, ctrl)
      void this.initiateOffer(slot)
    }
  }

  public retryPeer(peerId: string): void {
    this.ensurePeerConnection(peerId, true)
  }

  public removePeer(peerId: string): void {
    const slot = this.peers.get(peerId)
    if (!slot) return
    this.teardownPeerSlot(slot, "Peer disconnected")
    this.peers.delete(peerId)
    this.callbacks.onPeerDiagnostics(peerId, { state: "idle" })
  }

  public resetAllPeers(): void {
    for (const [, slot] of this.peers) {
      this.teardownPeerSlot(slot, "Room changed")
    }
    this.peers.clear()
  }

  public destroy(): void {
    this.destroyed = true
    this.resetAllPeers()
  }

  public broadcastManifest(items: RemoteShelfItem[]): void {
    const payload = JSON.stringify({
      type: "shelf:manifest",
      items,
    } satisfies ControlMessage)

    for (const [, slot] of this.peers) {
      this.enqueueControlJson(slot, payload)
    }
  }

  public sendControlMessage(peerId: string, message: ControlMessage): boolean {
    const slot = this.peers.get(peerId)
    if (!slot) return false
    return this.enqueueControlJson(slot, JSON.stringify(message))
  }

  public isPeerCtrlReady(peerId: string): boolean {
    const slot = this.peers.get(peerId)
    return Boolean(slot?.ctrlChannel && slot.ctrlChannel.readyState === "open")
  }

  public async waitForPeerConnected(
    peerId: string,
    timeoutMs = 10_000
  ): Promise<void> {
    if (this.isPeerCtrlReady(peerId)) return
    this.ensurePeerConnection(peerId, false)

    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (this.destroyed) throw new Error("Mesh destroyed")
      if (this.isPeerCtrlReady(peerId)) return
      await new Promise((r) => setTimeout(r, 80))
    }
    throw new Error("Peer P2P data channel did not open in time")
  }

  public async handleOfferSignal(fromPeerId: string, sdp: unknown): Promise<void> {
    if (this.destroyed || !this.selfPeerId) return

    const incomingSessionId = extractSdpSessionId(sdp)
    let slot = this.peers.get(fromPeerId)

    // Detect if remote peer tore down and created a brand-new RTCPeerConnection
    if (
      slot &&
      incomingSessionId &&
      slot.lastRemoteSessionId &&
      slot.lastRemoteSessionId !== incomingSessionId
    ) {
      this.teardownPeerSlot(slot, "Peer reset connection")
      this.peers.delete(fromPeerId)
      slot = undefined
    }

    if (!slot) {
      slot = this.createPeerSlot(fromPeerId)
      this.peers.set(fromPeerId, slot)
    }

    const polite = this.selfPeerId > fromPeerId
    const offerCollision =
      slot.makingOffer || slot.pc.signalingState !== "stable"
    slot.ignoreOffer = !polite && offerCollision
    if (slot.ignoreOffer) return

    if (incomingSessionId) {
      slot.lastRemoteSessionId = incomingSessionId
    }

    try {
      await slot.pc.setRemoteDescription(sdp as RTCSessionDescriptionInit)
      await this.flushPendingIceCandidates(slot)

      const answer = await slot.pc.createAnswer()
      await slot.pc.setLocalDescription(answer)
      if (slot.pc.localDescription) {
        this.callbacks.sendSignal({
          type: "rtc:answer",
          toPeerId: fromPeerId,
          sdp: slot.pc.localDescription.toJSON(),
        })
      }
    } catch (err) {
      this.updateDiagnostics(slot, {
        state: "unreachable",
        errorReason:
          err instanceof Error ? err.message : "Failed to accept WebRTC offer",
      })
    }
  }

  public async handleAnswerSignal(fromPeerId: string, sdp: unknown): Promise<void> {
    const slot = this.peers.get(fromPeerId)
    if (!slot) return

    const sessionId = extractSdpSessionId(sdp)
    if (sessionId) slot.lastRemoteSessionId = sessionId

    try {
      if (slot.pc.signalingState === "have-local-offer") {
        await slot.pc.setRemoteDescription(sdp as RTCSessionDescriptionInit)
        await this.flushPendingIceCandidates(slot)
      }
    } catch (err) {
      this.updateDiagnostics(slot, {
        state: "unreachable",
        errorReason:
          err instanceof Error ? err.message : "Failed to apply WebRTC answer",
      })
    }
  }

  public async handleIceSignal(
    fromPeerId: string,
    candidate: unknown
  ): Promise<void> {
    const slot = this.peers.get(fromPeerId)
    if (!slot || !candidate) return

    const init = candidate as RTCIceCandidateInit
    if (!slot.pc.remoteDescription) {
      slot.pendingCandidates.push(init)
      return
    }

    try {
      await slot.pc.addIceCandidate(new RTCIceCandidate(init))
    } catch {
      if (!slot.ignoreOffer) {
        // Ignore stale ICE candidates from superseded offers
      }
    }
  }

  public async sendFilesToPeer(options: {
    transferId: string
    peerId: string
    mode: "pull" | "direct"
    files: OutgoingTransferFileSpec[]
  }): Promise<void> {
    const { transferId, peerId, mode, files } = options
    await this.waitForPeerConnected(peerId)

    const slot = this.peers.get(peerId)
    if (!slot) {
      throw new Error("Target peer is no longer connected")
    }

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0)
    const channel = slot.pc.createDataChannel(`tesseract-xfer:${transferId}`, {
      ordered: true,
    })
    channel.binaryType = "arraybuffer"
    channel.bufferedAmountLowThreshold = LOW_WATER_THRESHOLD

    const control: OutgoingSendControl = {
      peerId,
      cancelled: false,
      channel,
    }
    this.outgoing.set(transferId, control)

    try {
      await this.waitForChannelOpen(channel, control)

      this.sendJsonFrame(channel, {
        type: "xfer:start",
        transferId,
        mode,
        fileCount: files.length,
        totalBytes,
      })

      let transferredBytes = 0
      let lastEmit = 0

      for (let i = 0; i < files.length; i++) {
        if (control.cancelled) {
          throw new Error(control.cancelReason || "Transfer cancelled")
        }

        const spec = files[i]!
        this.sendJsonFrame(channel, {
          type: "file:start",
          index: i,
          fileId: spec.fileId,
          name: spec.name,
          relativePath: spec.relativePath,
          size: spec.size,
          mimeType: spec.mimeType,
        })

        let offset = 0
        while (offset < spec.size) {
          if (control.cancelled) {
            throw new Error(control.cancelReason || "Transfer cancelled")
          }
          if (channel.readyState !== "open") {
            throw new Error("Peer data channel closed mid-transfer")
          }

          if (channel.bufferedAmount > HIGH_WATER_MARK) {
            await this.waitForBufferedAmountLow(channel, control)
          }

          const end = Math.min(offset + CHUNK_SIZE, spec.size)
          const buffer = await spec.file.slice(offset, end).arrayBuffer()
          channel.send(buffer)

          offset = end
          transferredBytes += buffer.byteLength

          const now = Date.now()
          if (now - lastEmit >= 120 || transferredBytes === totalBytes) {
            lastEmit = now
            this.callbacks.onTransferProgress(
              transferId,
              transferredBytes,
              totalBytes
            )
          }
        }

        this.sendJsonFrame(channel, {
          type: "file:end",
          index: i,
        })
      }

      this.sendJsonFrame(channel, { type: "xfer:end" })

      // Wait briefly for SCTP buffer drain + receiver acknowledgment before closing
      await this.waitForSenderDrainAndAck(channel, control)
      this.callbacks.onTransferProgress(transferId, totalBytes, totalBytes)
      this.callbacks.onTransferCompleted(transferId)
    } catch (err) {
      if (control.cancelled) {
        if (channel.readyState === "open") {
          try {
            this.sendJsonFrame(channel, {
              type: "xfer:cancel",
              reason: control.cancelReason || "Cancelled by sender",
            })
          } catch {}
        }
        this.callbacks.onTransferFailed(
          transferId,
          control.cancelReason || "Transfer cancelled",
          true
        )
      } else {
        const message =
          err instanceof Error ? err.message : "Transfer failed unexpectedly"
        this.callbacks.onTransferFailed(transferId, message, false)
      }
      throw err
    } finally {
      if (control.ackTimeout) clearTimeout(control.ackTimeout)
      this.outgoing.delete(transferId)
      try {
        if (channel.readyState === "open" || channel.readyState === "connecting") {
          channel.close()
        }
      } catch {}
    }
  }

  public cancelTransfer(transferId: string, peerId?: string, reason?: string): void {
    const out = this.outgoing.get(transferId)
    if (out) {
      out.cancelled = true
      out.cancelReason = reason || "Cancelled"
      out.ackResolve?.()
      try {
        if (out.channel?.readyState === "open") {
          this.sendJsonFrame(out.channel, {
            type: "xfer:cancel",
            reason: out.cancelReason,
          })
          out.channel.close()
        }
      } catch {}
    }

    const inc = this.incoming.get(transferId)
    if (inc) {
      inc.cancelled = true
      try {
        inc.channel.close()
      } catch {}
      void this.abortIncomingState(inc, reason || "Cancelled by receiver", true)
    }

    if (peerId) {
      this.sendControlMessage(peerId, {
        type: "xfer:cancel",
        transferId,
        reason,
      })
    }
  }

  private createPeerSlot(peerId: string): PeerSlot {
    const pc = new RTCPeerConnection(HOST_ONLY_RTC_CONFIG)
    const slot: PeerSlot = {
      peerId,
      pc,
      ctrlChannel: null,
      ctrlQueue: [],
      pendingCandidates: [],
      lastRemoteSessionId: null,
      makingOffer: false,
      ignoreOffer: false,
      unreachableTimer: null,
      diagnostics: { state: "connecting" },
    }

    this.updateDiagnostics(slot, { state: "connecting" })
    this.armUnreachableTimer(slot)

    pc.onicecandidate = (event) => {
      if (this.destroyed || this.peers.get(peerId) !== slot) return
      if (event.candidate) {
        this.callbacks.sendSignal({
          type: "rtc:ice",
          toPeerId: peerId,
          candidate: event.candidate.toJSON(),
        })
      }
    }

    pc.onconnectionstatechange = () => {
      if (this.destroyed || this.peers.get(peerId) !== slot) return
      const state = pc.connectionState
      if (state === "connected") {
        this.clearUnreachableTimer(slot)
        void this.inspectConnectedCandidate(slot)
      } else if (state === "failed") {
        this.clearUnreachableTimer(slot)
        this.updateDiagnostics(slot, {
          state: "unreachable",
          errorReason:
            "Local WebRTC handshake failed. Verify both devices are on the same LAN/Wi-Fi without client isolation.",
        })
      } else if (state === "disconnected") {
        this.updateDiagnostics(slot, {
          state: "connecting",
          errorReason: "Connection interrupted, attempting recovery…",
        })
        this.armUnreachableTimer(slot)
      }
    }

    pc.ondatachannel = (event) => {
      if (this.destroyed || this.peers.get(peerId) !== slot) return
      const channel = event.channel
      if (channel.label === "tesseract-ctrl") {
        this.attachControlChannel(slot, channel)
      } else if (channel.label.startsWith("tesseract-xfer:")) {
        const transferId = channel.label.slice("tesseract-xfer:".length)
        this.attachIncomingTransferChannel(slot.peerId, transferId, channel)
      }
    }

    return slot
  }

  private async initiateOffer(slot: PeerSlot): Promise<void> {
    try {
      slot.makingOffer = true
      const offer = await slot.pc.createOffer()
      await slot.pc.setLocalDescription(offer)
      if (slot.pc.localDescription && this.peers.get(slot.peerId) === slot) {
        this.callbacks.sendSignal({
          type: "rtc:offer",
          toPeerId: slot.peerId,
          sdp: slot.pc.localDescription.toJSON(),
        })
      }
    } catch (err) {
      this.updateDiagnostics(slot, {
        state: "unreachable",
        errorReason:
          err instanceof Error ? err.message : "Failed to create WebRTC offer",
      })
    } finally {
      slot.makingOffer = false
    }
  }

  private attachControlChannel(slot: PeerSlot, channel: RTCDataChannel): void {
    slot.ctrlChannel = channel

    channel.onopen = () => {
      if (this.destroyed || this.peers.get(slot.peerId) !== slot) return
      this.clearUnreachableTimer(slot)
      if (slot.diagnostics.state !== "connected") {
        void this.inspectConnectedCandidate(slot)
      }

      // Immediately push current local manifest to newly opened peer channel
      const manifest = this.callbacks.getLocalManifest()
      channel.send(
        JSON.stringify({
          type: "shelf:manifest",
          items: manifest,
        } satisfies ControlMessage)
      )

      // Flush any queued control messages
      while (slot.ctrlQueue.length > 0 && channel.readyState === "open") {
        const next = slot.ctrlQueue.shift()!
        channel.send(next)
      }
    }

    channel.onmessage = (event) => {
      if (typeof event.data !== "string") return
      try {
        const msg = JSON.parse(event.data) as ControlMessage
        this.handleControlMessage(slot.peerId, msg)
      } catch {
        // Ignore malformed control payload
      }
    }

    channel.onclose = () => {
      if (slot.ctrlChannel === channel) {
        slot.ctrlChannel = null
      }
    }
  }

  private handleControlMessage(peerId: string, msg: ControlMessage): void {
    switch (msg.type) {
      case "shelf:manifest":
        this.callbacks.onRemoteManifest(peerId, msg.items)
        break
      case "pull:request":
        this.callbacks.onPullRequest(peerId, msg)
        break
      case "pull:decision":
        this.callbacks.onPullDecision(peerId, msg)
        break
      case "direct:text":
        this.callbacks.onDirectTextDelivered(peerId, msg)
        break
      case "xfer:cancel":
        this.handleRemoteTransferCancel(msg.transferId, msg.reason)
        break
      case "xfer:ack": {
        const out = this.outgoing.get(msg.transferId)
        if (out?.ackResolve) {
          out.ackResolve()
        }
        break
      }
    }
  }

  private handleRemoteTransferCancel(transferId: string, reason?: string): void {
    const out = this.outgoing.get(transferId)
    if (out) {
      out.cancelled = true
      out.cancelReason = reason || "Cancelled by receiver"
      out.ackResolve?.()
      try {
        out.channel?.close()
      } catch {}
    }

    const inc = this.incoming.get(transferId)
    if (inc) {
      inc.cancelled = true
      try {
        inc.channel.close()
      } catch {}
      void this.abortIncomingState(
        inc,
        reason || "Cancelled by sender",
        true
      )
    }
  }

  private attachIncomingTransferChannel(
    peerId: string,
    transferId: string,
    channel: RTCDataChannel
  ): void {
    channel.binaryType = "arraybuffer"

    const state: IncomingReceiveState = {
      transferId,
      peerId,
      cancelled: false,
      mode: "pull",
      fileCount: 0,
      totalBytes: 0,
      transferredBytes: 0,
      lastProgressEmitAt: 0,
      sinkKind: null,
      singleSink: null,
      multiSink: null,
      currentFileSize: 0,
      currentFileReceived: 0,
      channel,
      chain: Promise.resolve(),
    }
    this.incoming.set(transferId, state)

    // Attach synchronously inside ondatachannel to ensure zero dropped frames
    channel.onmessage = (event) => {
      if (state.cancelled) return
      const payload = event.data
      state.chain = state.chain.then(async () => {
        if (state.cancelled) return
        await this.processIncomingFrame(state, payload)
      })
      state.chain.catch(async (err) => {
        const reason =
          err instanceof Error ? err.message : "Failed writing received data"
        await this.abortIncomingState(state, reason, false)
      })
    }

    channel.onclose = () => {
      state.chain = state.chain.then(async () => {
        if (this.incoming.has(transferId) && !state.cancelled) {
          // Channel closed unexpectedly before xfer:end
          await this.abortIncomingState(
            state,
            "Transfer channel closed before completion",
            false
          )
        }
      })
    }
  }

  private async processIncomingFrame(
    state: IncomingReceiveState,
    payload: string | ArrayBuffer | Blob
  ): Promise<void> {
    if (typeof payload === "string") {
      const header = JSON.parse(payload) as XferFrameHeader

      if (header.type === "xfer:start") {
        state.mode = header.mode
        state.fileCount = header.fileCount
        state.totalBytes = header.totalBytes
        this.callbacks.onIncomingTransferStarted?.({
          transferId: state.transferId,
          peerId: state.peerId,
          mode: header.mode,
          fileCount: header.fileCount,
          totalBytes: header.totalBytes,
        })
        return
      }

      if (header.type === "file:start") {
        if (!state.sinkKind) {
          const created = await this.callbacks.createReceiverSink({
            transferId: state.transferId,
            peerId: state.peerId,
            mode: state.mode,
            fileCount: state.fileCount,
            totalBytes: state.totalBytes,
            firstFileName: header.name,
            firstFileMimeType: header.mimeType,
          })
          state.sinkKind = created.kind
          if (created.kind === "single") {
            state.singleSink = created.sink
          } else {
            state.multiSink = created.sink
          }
        }

        state.currentFileSize = header.size
        state.currentFileReceived = 0

        if (state.sinkKind === "multi" && state.multiSink) {
          await state.multiSink.beginFile(header.relativePath, header.mimeType)
        }
        return
      }

      if (header.type === "file:end") {
        if (state.sinkKind === "multi" && state.multiSink) {
          await state.multiSink.endFile()
        }
        return
      }

      if (header.type === "xfer:end") {
        if (state.sinkKind === "single" && state.singleSink) {
          await state.singleSink.close()
        } else if (state.sinkKind === "multi" && state.multiSink) {
          await state.multiSink.finish()
        }
        this.incoming.delete(state.transferId)
        this.sendControlMessage(state.peerId, {
          type: "xfer:ack",
          transferId: state.transferId,
        })
        this.callbacks.onTransferProgress(
          state.transferId,
          state.totalBytes,
          state.totalBytes
        )
        this.callbacks.onTransferCompleted(state.transferId)
        try {
          state.channel.close()
        } catch {}
        return
      }

      if (header.type === "xfer:cancel") {
        await this.abortIncomingState(
          state,
          header.reason || "Cancelled by sender",
          true
        )
        return
      }
      return
    }

    const bytes =
      payload instanceof ArrayBuffer
        ? new Uint8Array(payload)
        : new Uint8Array(await payload.arrayBuffer())

    if (state.sinkKind === "single" && state.singleSink) {
      await state.singleSink.write(bytes)
    } else if (state.sinkKind === "multi" && state.multiSink) {
      await state.multiSink.writeChunk(bytes)
    }

    state.currentFileReceived += bytes.byteLength
    state.transferredBytes += bytes.byteLength

    const now = Date.now()
    if (
      now - state.lastProgressEmitAt >= 120 ||
      state.transferredBytes >= state.totalBytes
    ) {
      state.lastProgressEmitAt = now
      this.callbacks.onTransferProgress(
        state.transferId,
        state.transferredBytes,
        state.totalBytes
      )
    }
  }

  private async abortIncomingState(
    state: IncomingReceiveState,
    reason: string,
    cancelled: boolean
  ): Promise<void> {
    if (!this.incoming.has(state.transferId)) return
    this.incoming.delete(state.transferId)
    state.cancelled = true

    try {
      if (state.singleSink) await state.singleSink.abort()
      if (state.multiSink) await state.multiSink.abort()
    } catch {}

    this.callbacks.onTransferFailed(state.transferId, reason, cancelled)
  }

  private enqueueControlJson(slot: PeerSlot, json: string): boolean {
    if (slot.ctrlChannel && slot.ctrlChannel.readyState === "open") {
      slot.ctrlChannel.send(json)
      return true
    }
    slot.ctrlQueue.push(json)
    return false
  }

  private sendJsonFrame(channel: RTCDataChannel, frame: XferFrameHeader): void {
    channel.send(JSON.stringify(frame))
  }

  private async waitForChannelOpen(
    channel: RTCDataChannel,
    control: OutgoingSendControl
  ): Promise<void> {
    if (channel.readyState === "open") return
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        channel.removeEventListener("open", onOpen)
        channel.removeEventListener("close", onClose)
        channel.removeEventListener("error", onError)
        clearInterval(cancelCheck)
      }
      const onOpen = () => {
        cleanup()
        resolve()
      }
      const onClose = () => {
        cleanup()
        reject(new Error("Transfer channel closed before opening"))
      }
      const onError = () => {
        cleanup()
        reject(new Error("Transfer channel failed to open"))
      }
      const cancelCheck = setInterval(() => {
        if (control.cancelled || this.destroyed) {
          cleanup()
          reject(new Error(control.cancelReason || "Transfer cancelled"))
        }
      }, 100)

      channel.addEventListener("open", onOpen)
      channel.addEventListener("close", onClose)
      channel.addEventListener("error", onError)
    })
  }

  private async waitForBufferedAmountLow(
    channel: RTCDataChannel,
    control: OutgoingSendControl
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        channel.removeEventListener("bufferedamountlow", onLow)
        channel.removeEventListener("close", onClose)
        clearInterval(poll)
      }
      const onLow = () => {
        cleanup()
        resolve()
      }
      const onClose = () => {
        cleanup()
        reject(new Error("Data channel closed during transfer"))
      }
      const poll = setInterval(() => {
        if (control.cancelled || this.destroyed) {
          cleanup()
          reject(new Error(control.cancelReason || "Transfer cancelled"))
          return
        }
        if (channel.bufferedAmount <= LOW_WATER_THRESHOLD) {
          cleanup()
          resolve()
        }
      }, 50)

      channel.addEventListener("bufferedamountlow", onLow)
      channel.addEventListener("close", onClose)
    })
  }

  private async waitForSenderDrainAndAck(
    channel: RTCDataChannel,
    control: OutgoingSendControl
  ): Promise<void> {
    await new Promise<void>((resolve) => {
      let finished = false
      const done = () => {
        if (finished) return
        finished = true
        if (control.ackTimeout) clearTimeout(control.ackTimeout)
        channel.removeEventListener("close", done)
        clearInterval(drainPoll)
        resolve()
      }

      control.ackResolve = done

      // Wait up to 4s after bufferedAmount drains in case receiver takes a moment to flush OPFS
      const drainPoll = setInterval(() => {
        if (control.cancelled || channel.readyState !== "open") {
          done()
        }
      }, 80)

      control.ackTimeout = setTimeout(() => {
        if (channel.bufferedAmount === 0) {
          done()
        } else {
          setTimeout(done, 1_500)
        }
      }, 4_000)

      channel.addEventListener("close", done)
    })
  }

  private async flushPendingIceCandidates(slot: PeerSlot): Promise<void> {
    while (slot.pendingCandidates.length > 0) {
      const next = slot.pendingCandidates.shift()!
      try {
        await slot.pc.addIceCandidate(new RTCIceCandidate(next))
      } catch {
        // Ignore stale ICE candidates
      }
    }
  }

  private async inspectConnectedCandidate(slot: PeerSlot): Promise<void> {
    try {
      const stats = await slot.pc.getStats()
      let candidateType = "host"
      stats.forEach((report) => {
        if (
          report.type === "candidate-pair" &&
          report.state === "succeeded" &&
          report.nominated
        ) {
          const local = stats.get(report.localCandidateId)
          if (local) {
            candidateType = sanitizeDiagnosticCandidate(
              local.candidateType,
              local.protocol
            )
          }
        }
      })
      if (this.peers.get(slot.peerId) === slot) {
        this.updateDiagnostics(slot, {
          state: "connected",
          candidateType,
        })
      }
    } catch {
      if (this.peers.get(slot.peerId) === slot) {
        this.updateDiagnostics(slot, {
          state: "connected",
          candidateType: "host",
        })
      }
    }
  }

  private armUnreachableTimer(slot: PeerSlot): void {
    this.clearUnreachableTimer(slot)
    slot.unreachableTimer = setTimeout(() => {
      if (this.destroyed || this.peers.get(slot.peerId) !== slot) return
      if (slot.diagnostics.state !== "connected") {
        this.updateDiagnostics(slot, {
          state: "unreachable",
          errorReason:
            "P2P connection could not establish on local network. Check Wi-Fi client isolation, firewall rules, or mDNS settings.",
        })
      }
    }, UNREACHABLE_TIMEOUT_MS)
  }

  private clearUnreachableTimer(slot: PeerSlot): void {
    if (slot.unreachableTimer) {
      clearTimeout(slot.unreachableTimer)
      slot.unreachableTimer = null
    }
  }

  private updateDiagnostics(
    slot: PeerSlot,
    diag: PeerConnectionDiagnostics
  ): void {
    slot.diagnostics = diag
    this.callbacks.onPeerDiagnostics(slot.peerId, diag)
  }

  private teardownPeerSlot(slot: PeerSlot, reason: string): void {
    this.clearUnreachableTimer(slot)

    for (const [, out] of this.outgoing) {
      if (out.peerId === slot.peerId) {
        out.cancelled = true
        out.cancelReason = reason
        out.ackResolve?.()
        try {
          out.channel?.close()
        } catch {}
      }
    }

    for (const [, inc] of this.incoming) {
      if (inc.peerId === slot.peerId) {
        void this.abortIncomingState(inc, reason, false)
      }
    }

    try {
      slot.ctrlChannel?.close()
    } catch {}
    try {
      slot.pc.close()
    } catch {}
  }
}

export function buildTransferItemMetaList(
  items: Array<
    | { id: string; kind: "file"; name: string; size: number; mimeType: string }
    | { id: string; kind: "folder"; name: string; totalSize: number; fileCount: number }
    | { id: string; kind: "text"; content: string }
  >
): TesseractTransferItemMeta[] {
  return items.map((item) => {
    if (item.kind === "file") {
      return {
        id: item.id,
        kind: "file",
        name: item.name,
        size: item.size,
        mimeType: item.mimeType,
      }
    }
    if (item.kind === "folder") {
      return {
        id: item.id,
        kind: "folder",
        name: item.name,
        size: item.totalSize,
        fileCount: item.fileCount,
      }
    }
    return {
      id: item.id,
      kind: "text",
      name: "Text Snippet",
      size: new Blob([item.content]).size,
      textPreview: item.content.slice(0, 120),
    }
  })
}
