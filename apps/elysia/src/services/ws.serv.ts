import { LogFactory } from '@Iris/logger'
import { jwtVerify } from 'jose'

const logger = new LogFactory('Elysia:WebSocket')

export interface IrisWebSocket {
  send(data: string, compress?: boolean): unknown
  close?(code?: number, reason?: string): void
  readonly id?: string
  readonly subscriptions?: readonly string[]
  readonly remoteAddress?: string
  [key: string]: unknown
}

export interface WsMessagePayload<T = unknown> {
  event: string
  data: T
  channel?: string
  timestamp: number
}

export class WsServ {
  private static instance: WsServ

  // Mapping from userId -> Set of active WebSocket connections
  private userConnections = new Map<string, Set<IrisWebSocket>>()

  // Mapping from connection -> userId
  private connectionUsers = new Map<IrisWebSocket, string>()

  // Mapping from channel/topic name -> Set of subscribed WebSockets
  private channelSubscriptions = new Map<string, Set<IrisWebSocket>>()

  // Mapping from connection -> Set of channels it subscribed to
  private connectionChannels = new Map<IrisWebSocket, Set<string>>()

  public static getInstance(): WsServ {
    if (!WsServ.instance) {
      WsServ.instance = new WsServ()
    }
    return WsServ.instance
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
    if (userId && typeof userId === 'string' && userId.trim().length > 0) {
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

    if (!this.connectionChannels.has(ws)) {
      this.connectionChannels.set(ws, new Set())
    }
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
      logger.warn(`Error sending message over WebSocket: ${err}`)
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
    this.broadcastChannel('media', event, data)
  }

  /**
   * Handles incoming message frames from clients.
   */
  public async handleMessage(ws: IrisWebSocket, rawMessage: unknown): Promise<void> {
    try {
      let parsed: unknown = rawMessage
      if (typeof rawMessage === 'string') {
        parsed = JSON.parse(rawMessage)
      }

      if (!parsed || typeof parsed !== 'object') return

      const msg = parsed as Record<string, unknown>

      // Authenticate via signed JWT token frame
      if (
        msg.type === 'auth' &&
        typeof msg.token === 'string' &&
        msg.token.trim().length > 0
      ) {
        const secret = Bun.env.JWT_SECRET
        if (secret) {
          try {
            const secretKey = new TextEncoder().encode(secret)
            const { payload } = await jwtVerify(msg.token.trim(), secretKey)
            if (payload && payload.id && typeof payload.id === 'string') {
              const uid = payload.id.trim()
              const conn = (ws as any).raw ?? ws
              const alreadyRegistered = this.connectionUsers.get(conn) === uid
              this.register(conn, uid)
              this.send(conn, 'auth:success', { userId: uid })
              if (!alreadyRegistered) {
                logger.info(`Client authenticated via token: user ${uid}`)
              }
              return
            }
          } catch {
            this.send(ws, 'auth:error', { message: 'Invalid or expired authentication token' })
            return
          }
        }
      }

      if (msg.type === 'ping') {
        this.send(ws, 'pong', { timestamp: Date.now() })
        return
      }

      if (msg.type === 'subscribe' && typeof msg.channel === 'string') {
        const channel = msg.channel.trim()
        const currentUid = this.getUserId(ws)
        // Restrict private user channels strictly to the authenticated user
        if (channel.startsWith('user:')) {
          const targetUid = channel.slice(5)
          if (!currentUid || currentUid !== targetUid) {
            this.send(ws, 'error', { message: 'Unauthorized channel subscription' })
            return
          }
        }
        this.subscribe(ws, channel)
        this.send(ws, 'subscribed', { channel })
        return
      }

      if (msg.type === 'unsubscribe' && typeof msg.channel === 'string') {
        this.unsubscribe(ws, msg.channel)
        this.send(ws, 'unsubscribed', { channel: msg.channel })
        return
      }
    } catch {
      // Ignore malformed JSON messages
    }
  }
}

export const wsHub = WsServ.getInstance()
