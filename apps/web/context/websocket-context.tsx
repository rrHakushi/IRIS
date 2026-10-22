"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"
import { useSession } from "@/context/session-context"
import { API_URL } from "@/lib/elysia"

export interface WsMessage<T = any> {
  event: string
  data: T
  channel?: string
  timestamp: number
}

export type WsSubscriptionCallback = (message: WsMessage) => void

export interface WebSocketContextValue {
  /** Whether the global WebSocket connection is active */
  isConnected: boolean
  /** Authenticated user ID confirmed by the server over WebSocket */
  authenticatedUserId: string | null
  /** Subscribes to an event or channel. Returns an unsubscribe function. */
  subscribe: (
    eventOrChannel: string,
    callback: WsSubscriptionCallback
  ) => () => void
  /** Sends a raw or custom event over WebSocket */
  send: (typeOrEvent: string, data?: Record<string, unknown>) => void
  /** Connects or force-reconnects the WebSocket */
  reconnect: (force?: boolean) => void
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  authenticatedUserId: null,
  subscribe: () => () => {},
  send: () => {},
  reconnect: () => {},
})

// =============================================================================
// Persistent Singleton Connection State (survives route navigation & re-renders)
// =============================================================================
let globalWs: WebSocket | null = null
let globalAuthenticatedUserId: string | null = null
let globalActiveUserId: string | null = null
let globalHeartbeatInterval: ReturnType<typeof setInterval> | null = null
let globalReconnectTimeout: ReturnType<typeof setTimeout> | null = null
let globalReconnectAttempts = 0
let globalIsConnecting = false

// Global subscriber registries
const globalListeners = new Map<string, Set<WsSubscriptionCallback>>()
const connectionListeners = new Set<
  (connected: boolean, userId: string | null) => void
>()

function notifyConnectionChange(connected: boolean, userId: string | null) {
  connectionListeners.forEach((cb) => {
    try {
      cb(connected, userId)
    } catch {}
  })
}

function dispatchIncomingMessage(msg: WsMessage) {
  // 1. Direct event match (e.g. "notification:new")
  const eventListeners = globalListeners.get(msg.event)
  if (eventListeners) {
    eventListeners.forEach((cb) => {
      try {
        cb(msg)
      } catch (e) {
        console.error("[WebSocket] Listener error:", e)
      }
    })
  }

  // 2. Channel match (e.g. "user:123")
  if (msg.channel) {
    const channelListeners = globalListeners.get(msg.channel)
    if (channelListeners) {
      channelListeners.forEach((cb) => {
        try {
          cb(msg)
        } catch (e) {
          console.error("[WebSocket] Channel listener error:", e)
        }
      })
    }
  }

  // 3. Catch-all "*" listener
  const allListeners = globalListeners.get("*")
  if (allListeners) {
    allListeners.forEach((cb) => {
      try {
        cb(msg)
      } catch (e) {
        console.error("[WebSocket] Global listener error:", e)
      }
    })
  }
}

function getWebSocketUrl(userId?: string | null): string {
  try {
    const raw = API_URL || "http://localhost:4000"
    const cleaned = raw.replace(/\$\{ELYSIA_PORT\}|\$ELYSIA_PORT/g, "4000")
    const url = new URL(cleaned)
    const protocol = url.protocol === "https:" ? "wss:" : "ws:"
    const host = url.host || "localhost:4000"
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : ""
    return `${protocol}//${host}/ws${query}`
  } catch {
    const host =
      typeof window !== "undefined" ? window.location.hostname : "localhost"
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : ""
    return `ws://${host}:4000/ws${query}`
  }
}

function ensureWebSocketConnected(
  userId: string | null | undefined,
  force = false
) {
  if (typeof window === "undefined") return

  // Unauthenticated -> disconnect cleanly
  if (!userId) {
    if (globalWs) {
      try {
        globalWs.close(1000, "Logout")
      } catch {}
      globalWs = null
    }
    globalAuthenticatedUserId = null
    globalActiveUserId = null
    if (globalHeartbeatInterval) {
      clearInterval(globalHeartbeatInterval)
      globalHeartbeatInterval = null
    }
    if (globalReconnectTimeout) {
      clearTimeout(globalReconnectTimeout)
      globalReconnectTimeout = null
    }
    notifyConnectionChange(false, null)
    return
  }

  // Already connected or actively establishing for the same user -> DO NOT DISCONNECT OR RECONNECT
  if (
    !force &&
    globalWs &&
    (globalWs.readyState === WebSocket.OPEN ||
      globalWs.readyState === WebSocket.CONNECTING) &&
    globalActiveUserId === userId
  ) {
    if (globalWs.readyState === WebSocket.OPEN) {
      notifyConnectionChange(true, globalAuthenticatedUserId ?? userId)
    }
    return
  }

  // Force reconnect or switching to another user
  if (globalWs && (force || globalActiveUserId !== userId)) {
    try {
      globalWs.close()
    } catch {}
    globalWs = null
  }

  if (globalReconnectTimeout) {
    clearTimeout(globalReconnectTimeout)
    globalReconnectTimeout = null
  }

  try {
    globalIsConnecting = true
    globalActiveUserId = userId
    const wsUrl = getWebSocketUrl(userId)
    const ws = new WebSocket(wsUrl)
    globalWs = ws

    ws.onopen = () => {
      if (globalWs !== ws) return
      globalIsConnecting = false
      globalReconnectAttempts = 0
      globalAuthenticatedUserId = userId
      notifyConnectionChange(true, userId)

      // Send auth frame immediately
      try {
        ws.send(JSON.stringify({ type: "auth", userId }))
      } catch {}

      // Re-subscribe any channels previously registered in globalListeners
      for (const channel of globalListeners.keys()) {
        if (!channel.includes(":") && channel !== "*") {
          try {
            ws.send(JSON.stringify({ type: "subscribe", channel }))
          } catch {}
        }
      }

      // Heartbeat ping every 15 seconds
      if (globalHeartbeatInterval) clearInterval(globalHeartbeatInterval)
      globalHeartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping" }))
          } catch {}
        }
      }, 15000)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.event === "auth:success" && data.data?.userId) {
          globalAuthenticatedUserId = data.data.userId
          notifyConnectionChange(true, data.data.userId)
        }
        dispatchIncomingMessage(data)
      } catch {
        // Non-JSON frame ignored
      }
    }

    ws.onclose = (event) => {
      if (globalWs !== ws) return
      globalWs = null
      globalIsConnecting = false
      notifyConnectionChange(false, null)

      if (globalHeartbeatInterval) {
        clearInterval(globalHeartbeatInterval)
        globalHeartbeatInterval = null
      }

      // Do not reconnect if unauthorized (4401) or if session is unauthenticated
      if (event.code === 4401 || !globalActiveUserId) {
        return
      }

      // Reconnect with exponential backoff (min 1s, max 10s)
      const delay = Math.min(1000 * 2 ** globalReconnectAttempts, 10000)
      globalReconnectAttempts += 1
      if (globalReconnectTimeout) clearTimeout(globalReconnectTimeout)
      globalReconnectTimeout = setTimeout(() => {
        ensureWebSocketConnected(globalActiveUserId, false)
      }, delay)
    }

    ws.onerror = () => {
      // onclose handles reconnect
    }
  } catch (err) {
    console.warn("[WebSocket] Connection attempt failed:", err)
    globalIsConnecting = false
  }
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  const [isConnected, setIsConnected] = useState<boolean>(
    () => globalWs?.readyState === WebSocket.OPEN
  )
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(
    () => globalAuthenticatedUserId
  )

  useEffect(() => {
    const handleConnectionUpdate = (
      connected: boolean,
      authUserId: string | null
    ) => {
      setIsConnected(connected)
      setAuthenticatedUserId(authUserId)
    }

    connectionListeners.add(handleConnectionUpdate)

    // Sync initial state on mount
    if (globalWs?.readyState === WebSocket.OPEN) {
      setIsConnected(true)
      setAuthenticatedUserId(globalAuthenticatedUserId ?? userId ?? null)
    }

    return () => {
      connectionListeners.delete(handleConnectionUpdate)
    }
  }, [userId])

  useEffect(() => {
    if (status === "authenticated" && userId) {
      ensureWebSocketConnected(userId, false)
    } else if (status === "unauthenticated") {
      ensureWebSocketConnected(null, false)
    }
  }, [status, userId])

  const subscribe = useCallback(
    (
      eventOrChannel: string,
      callback: WsSubscriptionCallback
    ): (() => void) => {
      let set = globalListeners.get(eventOrChannel)
      if (!set) {
        set = new Set()
        globalListeners.set(eventOrChannel, set)

        if (
          globalWs?.readyState === WebSocket.OPEN &&
          !eventOrChannel.includes(":") &&
          eventOrChannel !== "*"
        ) {
          try {
            globalWs.send(
              JSON.stringify({ type: "subscribe", channel: eventOrChannel })
            )
          } catch {}
        }
      }
      set.add(callback)

      return () => {
        const currentSet = globalListeners.get(eventOrChannel)
        if (currentSet) {
          currentSet.delete(callback)
          if (currentSet.size === 0) {
            globalListeners.delete(eventOrChannel)
            if (
              globalWs?.readyState === WebSocket.OPEN &&
              !eventOrChannel.includes(":") &&
              eventOrChannel !== "*"
            ) {
              try {
                globalWs.send(
                  JSON.stringify({
                    type: "unsubscribe",
                    channel: eventOrChannel,
                  })
                )
              } catch {}
            }
          }
        }
      }
    },
    []
  )

  const send = useCallback(
    (typeOrEvent: string, data?: Record<string, unknown>) => {
      if (globalWs?.readyState === WebSocket.OPEN) {
        try {
          globalWs.send(
            JSON.stringify({
              type: typeOrEvent,
              event: typeOrEvent,
              ...data,
            })
          )
        } catch (e) {
          console.warn("[WebSocket] Failed to send frame:", e)
        }
      }
    },
    []
  )

  const reconnect = useCallback(
    (force = true) => {
      if (status !== "authenticated" || !userId) return
      ensureWebSocketConnected(userId, force)
    },
    [status, userId]
  )

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        authenticatedUserId,
        subscribe,
        send,
        reconnect,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider")
  }
  return context
}
