import { ElysiaWS } from "elysia/ws"
import { logger } from "../utils/logger.js"

export interface IrisWebSocket {
  send(data: string, compress?: boolean): unknown
  close?(code?: number, reason?: string): void
  readonly id?: string
  readonly subscriptions?: readonly string[]
  readonly remoteAddress?: string
}

export interface WsMessagePayload<T = unknown> {
  event: string
  data: T
  channel?: string
  timestamp: number
}

export class WebSocketHub {
  private static instance: WebSocketHub
  private static logged = false

  // Mapping from userId -> Set of active WebSocket connections
  private userConnections = new Map<string, Set<IrisWebSocket>>()

  // Mapping from connection -> userId
  private connectionUsers = new Map<IrisWebSocket, string>()

  // Mapping from channel/topic name -> Set of subscribed WebSockets
  private channelSubscriptions = new Map<string, Set<IrisWebSocket>>()

  // Mapping from connection -> Set of channels it subscribed to
  private connectionChannels = new Map<IrisWebSocket, Set<string>>()

  private constructor() {
    WebSocketHub.logStatus()
  }

  public static logStatus(): void {
    if (WebSocketHub.logged) return
    WebSocketHub.logged = true
    logger.service("websocket-hub", "realtime websocket hub & pub/sub manager")
  }

  public static getInstance(): WebSocketHub {
    if (!WebSocketHub.instance) {
      WebSocketHub.instance = new WebSocketHub()
    }
    return WebSocketHub.instance
  }

  public hasConnection(ws: IrisWebSocket): boolean {
    return this.connectionUsers.has(ws)
  }

  public getUserId(ws: IrisWebSocket): string | undefined {
    return this.connectionUsers.get(ws)
  }

  /**
   * Registers a newly opened WebSocket connection.
   */
  public register(ws: IrisWebSocket, userId?: string | null): void {
    if (userId && typeof userId === "string" && userId.trim().length > 0) {
      const uid = userId.trim()
      this.connectionUsers.set(ws, uid)
      let sockets = this.userConnections.get(uid)
      if (!sockets) {
        sockets = new Set()
        this.userConnections.set(uid, sockets)
      }
      sockets.add(ws)

      // Automatically subscribe the user to their private channel
      this.subscribe(ws, `user:${uid}`)
    }

    this.connectionChannels.set(ws, new Set())
  }

  /**
   * Unregisters and cleans up a closed WebSocket connection.
   */
  public unregister(ws: IrisWebSocket): void {
    const userId = this.connectionUsers.get(ws)
    if (userId) {
      const sockets = this.userConnections.get(userId)
      if (sockets) {
        sockets.delete(ws)
        if (sockets.size === 0) {
          this.userConnections.delete(userId)
        }
      }
      this.connectionUsers.delete(ws)
    }

    const channels = this.connectionChannels.get(ws)
    if (channels) {
      for (const channel of channels) {
        const subscribers = this.channelSubscriptions.get(channel)
        if (subscribers) {
          subscribers.delete(ws)
          if (subscribers.size === 0) {
            this.channelSubscriptions.delete(channel)
          }
        }
      }
      this.connectionChannels.delete(ws)
    }
  }

  /**
   * Subscribes a WebSocket connection to a specific channel/topic.
   */
  public subscribe(ws: IrisWebSocket, channel: string): void {
    let subscribers = this.channelSubscriptions.get(channel)
    if (!subscribers) {
      subscribers = new Set()
      this.channelSubscriptions.set(channel, subscribers)
    }
    subscribers.add(ws)

    let userChans = this.connectionChannels.get(ws)
    if (!userChans) {
      userChans = new Set()
      this.connectionChannels.set(ws, userChans)
    }
    userChans.add(channel)
  }

  /**
   * Unsubscribes a WebSocket connection from a channel.
   */
  public unsubscribe(ws: IrisWebSocket, channel: string): void {
    const subscribers = this.channelSubscriptions.get(channel)
    if (subscribers) {
      subscribers.delete(ws)
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel)
      }
    }

    const userChans = this.connectionChannels.get(ws)
    if (userChans) {
      userChans.delete(channel)
    }
  }

  /**
   * Sends an event payload to a single specific WebSocket connection.
   */
  public send(
    ws: IrisWebSocket,
    event: string,
    data: unknown,
    channel?: string
  ): void {
    try {
      const payload: WsMessagePayload = {
        event,
        data,
        channel,
        timestamp: Date.now(),
      }
      ws.send(JSON.stringify(payload))
    } catch (err) {
      console.warn("[WebSocketHub] Error sending to socket:", err)
    }
  }

  /**
   * Sends a targeted real-time event to all active sessions of a given user.
   */
  public sendToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userConnections.get(userId)
    if (!sockets || sockets.size === 0) return

    for (const ws of sockets) {
      this.send(ws, event, data, `user:${userId}`)
    }
  }

  /**
   * Broadcasts an event to all subscribers of a channel.
   */
  public broadcastChannel(
    channel: string,
    event: string,
    data: unknown,
    excludeWs?: IrisWebSocket
  ): void {
    const subscribers = this.channelSubscriptions.get(channel)
    if (!subscribers || subscribers.size === 0) return

    for (const ws of subscribers) {
      if (excludeWs && ws === excludeWs) continue
      this.send(ws, event, data, channel)
    }
  }

  /**
   * Broadcasts an event to all active WebSocket connections across all channels.
   */
  public broadcast(event: string, data: unknown): void {
    for (const ws of this.connectionUsers.keys()) {
      this.send(ws, event, data)
    }
    this.broadcastChannel("media", event, data)
  }

  /**
   * Handles incoming message frames from clients.
   */
  public handleMessage(ws: IrisWebSocket, rawMessage: unknown): void {
    try {
      let parsed: unknown = rawMessage
      if (typeof rawMessage === "string") {
        parsed = JSON.parse(rawMessage)
      }

      if (!parsed || typeof parsed !== "object") return

      const msg = parsed as Record<string, unknown>

      if (
        msg.type === "auth" &&
        typeof msg.userId === "string" &&
        msg.userId.trim().length > 0
      ) {
        const uid = msg.userId.trim()
        const alreadyRegistered = this.connectionUsers.get(ws) === uid
        this.register(ws, uid)
        this.send(ws, "auth:success", { userId: uid })
        if (!alreadyRegistered) {
          logger.ws.connected(uid)
        }
        return
      }

      if (msg.type === "ping") {
        this.send(ws, "pong", { timestamp: Date.now() })
        return
      }

      if (msg.type === "subscribe" && typeof msg.channel === "string") {
        this.subscribe(ws, msg.channel)
        this.send(ws, "subscribed", { channel: msg.channel })
        return
      }

      if (msg.type === "unsubscribe" && typeof msg.channel === "string") {
        this.unsubscribe(ws, msg.channel)
        this.send(ws, "unsubscribed", { channel: msg.channel })
        return
      }
    } catch {
      // Ignore malformed JSON messages
    }
  }
}

export const wsHub = WebSocketHub.getInstance()
