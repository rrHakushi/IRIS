import type {
  TesseractClientSignal,
  TesseractServerEvent,
} from "@NamelessLiberty/shared"

export interface SignalingConnectOptions {
  deviceId?: string
  tabId?: string
  alias: string
  deviceType: string
  os: string
  browser: string
  requireShelfApproval?: boolean
  onEvent: (event: TesseractServerEvent) => void
  onTransportState?: (state: "connecting" | "connected" | "disconnected", mode: "ws" | "sse") => void
}

export class TesseractSignalingClient {
  private options: SignalingConnectOptions
  private ws: WebSocket | null = null
  private sse: EventSource | null = null
  private mode: "ws" | "sse" = "ws"
  private peerId: string | null = null
  private sseSecret: string | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private closedManually = false
  private hasJoinedOnce = false

  constructor(options: SignalingConnectOptions) {
    this.options = options
  }

  public connect(): void {
    this.closedManually = false
    this.connectWebSocket()
  }

  public updateOptions(patch: Partial<Pick<SignalingConnectOptions, "alias" | "requireShelfApproval">>) {
    if (patch.alias !== undefined) this.options.alias = patch.alias
    if (patch.requireShelfApproval !== undefined) {
      this.options.requireShelfApproval = patch.requireShelfApproval
    }
  }

  private buildQueryString(): string {
    const params = new URLSearchParams()
    if (this.options.deviceId) params.set("deviceId", this.options.deviceId)
    if (this.options.tabId) params.set("tabId", this.options.tabId)
    params.set("alias", this.options.alias)
    params.set("deviceType", this.options.deviceType)
    params.set("os", this.options.os)
    params.set("browser", this.options.browser)
    if (this.options.requireShelfApproval) params.set("approval", "true")
    return params.toString()
  }

  private clearTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private connectWebSocket(): void {
    if (typeof window === "undefined" || this.closedManually) return
    this.clearTimers()

    this.mode = "ws"
    this.options.onTransportState?.("connecting", "ws")

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const url = `${protocol}//${window.location.host}/elysia/tesseract/ws?${this.buildQueryString()}`

    let opened = false
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onopen = () => {
      if (this.ws !== ws || this.closedManually) return
      opened = true
      this.reconnectAttempts = 0
      this.options.onTransportState?.("connected", "ws")

      this.heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          this.send({ type: "ping" })
        }
      }, 15_000)
    }

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as TesseractServerEvent & {
          sseSecret?: string
        }
        if (parsed.event === "room:joined") {
          this.hasJoinedOnce = true
          this.peerId = parsed.data.selfPeerId
        }
        this.options.onEvent(parsed)
      } catch {}
    }

    ws.onclose = (ev) => {
      if (this.ws !== ws) return
      this.ws = null
      this.clearTimers()

      if (this.closedManually) {
        this.options.onTransportState?.("disconnected", "ws")
        return
      }

      // Do not retry if server explicitly rejected room/PIN
      if (ev.code === 4403 || ev.code === 4404) {
        this.options.onTransportState?.("disconnected", "ws")
        return
      }

      // If WebSocket never opened (e.g., proxy doesn't forward WS upgrades), switch to SSE fallback
      if (!opened && !this.hasJoinedOnce) {
        this.connectSse()
        return
      }

      this.options.onTransportState?.("disconnected", "ws")
      const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10_000)
      this.reconnectAttempts += 1
      this.reconnectTimer = setTimeout(() => {
        this.connectWebSocket()
      }, delay)
    }

    ws.onerror = () => {
      // Handled cleanly in onclose
    }
  }

  private connectSse(): void {
    if (typeof window === "undefined" || this.closedManually) return
    this.clearTimers()

    this.mode = "sse"
    this.options.onTransportState?.("connecting", "sse")

    const url = `/elysia/tesseract/events?${this.buildQueryString()}`
    const es = new EventSource(url, { withCredentials: true })
    this.sse = es

    es.onopen = () => {
      if (this.sse !== es || this.closedManually) return
      this.reconnectAttempts = 0
      this.options.onTransportState?.("connected", "sse")

      this.heartbeatTimer = setInterval(() => {
        this.send({ type: "ping" })
      }, 15_000)
    }

    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as TesseractServerEvent & {
          sseSecret?: string
        }
        if (parsed.event === "room:joined") {
          this.hasJoinedOnce = true
          this.peerId = parsed.data.selfPeerId
          this.sseSecret = parsed.sseSecret ?? null
        }
        this.options.onEvent(parsed)
      } catch {}
    }

    es.onerror = () => {
      if (this.sse !== es) return
      es.close()
      this.sse = null
      this.clearTimers()
      this.options.onTransportState?.("disconnected", "sse")

      if (this.closedManually) return

      const delay = Math.min(1500 * 2 ** this.reconnectAttempts, 10_000)
      this.reconnectAttempts += 1
      this.reconnectTimer = setTimeout(() => {
        this.connectSse()
      }, delay)
    }
  }

  public send(payload: TesseractClientSignal): void {
    if (this.mode === "ws") {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(payload))
        } catch {}
      }
      return
    }

    if (this.peerId && this.sseSecret) {
      fetch("/elysia/tesseract/signal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerId: this.peerId,
          sseSecret: this.sseSecret,
          payload,
        }),
      }).catch(() => {})
    }
  }

  public sendUnloadLeave(): void {
    if (this.mode === "ws") {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "leave" }))
          this.ws.close(1000, "Page unload")
        } catch {}
      }
      return
    }

    if (
      this.peerId &&
      this.sseSecret &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob(
        [
          JSON.stringify({
            peerId: this.peerId,
            sseSecret: this.sseSecret,
            payload: { type: "leave" },
          }),
        ],
        { type: "application/json" }
      )
      navigator.sendBeacon("/elysia/tesseract/signal", blob)
    }
  }

  public disconnect(): void {
    this.closedManually = true
    this.clearTimers()
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "leave" }))
        }
        this.ws.close(1000, "Disconnect")
      } catch {}
      this.ws = null
    }
    if (this.sse) {
      this.sendUnloadLeave()
      try {
        this.sse.close()
      } catch {}
      this.sse = null
    }
    this.peerId = null
    this.sseSecret = null
  }
}

