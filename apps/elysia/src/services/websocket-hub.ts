import type { ElysiaWS } from "elysia/ws";

export interface WsMessagePayload<T = unknown> {
  event: string;
  data: T;
  channel?: string;
  timestamp: number;
}

export class WebSocketHub {
  private static instance: WebSocketHub;

  // Mapping from userId -> Set of active WebSocket connections
  private userConnections = new Map<string, Set<ElysiaWS<any>>>();

  // Mapping from connection -> userId
  private connectionUsers = new Map<ElysiaWS<any>, string>();

  // Mapping from channel/topic name -> Set of subscribed WebSockets
  private channelSubscriptions = new Map<string, Set<ElysiaWS<any>>>();

  // Mapping from connection -> Set of channels it subscribed to
  private connectionChannels = new Map<ElysiaWS<any>, Set<string>>();

  private constructor() {}

  public static getInstance(): WebSocketHub {
    if (!WebSocketHub.instance) {
      WebSocketHub.instance = new WebSocketHub();
    }
    return WebSocketHub.instance;
  }

  /**
   * Registers a newly opened WebSocket connection.
   */
  public register(ws: ElysiaWS<any>, userId?: string | null): void {
    if (userId) {
      this.connectionUsers.set(ws, userId);
      let sockets = this.userConnections.get(userId);
      if (!sockets) {
        sockets = new Set();
        this.userConnections.set(userId, sockets);
      }
      sockets.add(ws);

      // Automatically subscribe the user to their private channel
      this.subscribe(ws, `user:${userId}`);
    }

    this.connectionChannels.set(ws, new Set());
  }

  /**
   * Unregisters and cleans up a closed WebSocket connection.
   */
  public unregister(ws: ElysiaWS<any>): void {
    const userId = this.connectionUsers.get(ws);
    if (userId) {
      const sockets = this.userConnections.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) {
          this.userConnections.delete(userId);
        }
      }
      this.connectionUsers.delete(ws);
    }

    const channels = this.connectionChannels.get(ws);
    if (channels) {
      for (const channel of channels) {
        const subscribers = this.channelSubscriptions.get(channel);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            this.channelSubscriptions.delete(channel);
          }
        }
      }
      this.connectionChannels.delete(ws);
    }
  }

  /**
   * Subscribes a WebSocket connection to a specific channel/topic.
   */
  public subscribe(ws: ElysiaWS<any>, channel: string): void {
    let subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers) {
      subscribers = new Set();
      this.channelSubscriptions.set(channel, subscribers);
    }
    subscribers.add(ws);

    let userChans = this.connectionChannels.get(ws);
    if (!userChans) {
      userChans = new Set();
      this.connectionChannels.set(ws, userChans);
    }
    userChans.add(channel);
  }

  /**
   * Unsubscribes a WebSocket connection from a channel.
   */
  public unsubscribe(ws: ElysiaWS<any>, channel: string): void {
    const subscribers = this.channelSubscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(ws);
      if (subscribers.size === 0) {
        this.channelSubscriptions.delete(channel);
      }
    }

    const userChans = this.connectionChannels.get(ws);
    if (userChans) {
      userChans.delete(channel);
    }
  }

  /**
   * Sends an event payload to a single specific WebSocket connection.
   */
  public send(ws: ElysiaWS<any>, event: string, data: unknown, channel?: string): void {
    try {
      const payload: WsMessagePayload = {
        event,
        data,
        channel,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(payload));
    } catch (err) {
      console.warn("[WebSocketHub] Error sending to socket:", err);
    }
  }

  /**
   * Sends a targeted real-time event to all active sessions of a given user.
   */
  public sendToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userConnections.get(userId);
    if (!sockets || sockets.size === 0) return;

    for (const ws of sockets) {
      this.send(ws, event, data, `user:${userId}`);
    }
  }

  /**
   * Broadcasts an event to all subscribers of a channel.
   */
  public broadcastChannel(
    channel: string,
    event: string,
    data: unknown,
    excludeWs?: ElysiaWS<any>
  ): void {
    const subscribers = this.channelSubscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    for (const ws of subscribers) {
      if (excludeWs && ws === excludeWs) continue;
      this.send(ws, event, data, channel);
    }
  }

  /**
   * Handles incoming message frames from clients.
   */
  public handleMessage(ws: ElysiaWS<any>, rawMessage: unknown): void {
    try {
      let parsed: any = rawMessage;
      if (typeof rawMessage === "string") {
        parsed = JSON.parse(rawMessage);
      }

      if (!parsed || typeof parsed !== "object") return;

      if (parsed.type === "auth" && typeof parsed.userId === "string" && parsed.userId.trim().length > 0) {
        const uid = parsed.userId.trim();
        this.register(ws, uid);
        this.send(ws, "auth:success", { userId: uid });
        console.log(
          `\x1b[35m\x1b[1m[WebSocket]\x1b[0m \x1b[32mClient authenticated:\x1b[0m user=\x1b[36m${uid}\x1b[0m`
        );
        return;
      }

      if (parsed.type === "ping") {
        this.send(ws, "pong", { timestamp: Date.now() });
        return;
      }

      if (parsed.type === "subscribe" && typeof parsed.channel === "string") {
        this.subscribe(ws, parsed.channel);
        this.send(ws, "subscribed", { channel: parsed.channel });
        return;
      }

      if (parsed.type === "unsubscribe" && typeof parsed.channel === "string") {
        this.unsubscribe(ws, parsed.channel);
        this.send(ws, "unsubscribed", { channel: parsed.channel });
        return;
      }
    } catch {
      // Ignore malformed JSON messages
    }
  }
}

export const wsHub = WebSocketHub.getInstance();
