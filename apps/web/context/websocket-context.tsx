"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { API_URL } from "@/lib/elysia";

export interface WsMessage<T = any> {
  event: string;
  data: T;
  channel?: string;
  timestamp: number;
}

export type WsSubscriptionCallback = (message: WsMessage) => void;

export interface WebSocketContextValue {
  /** Whether the global WebSocket connection is active */
  isConnected: boolean;
  /** Authenticated user ID confirmed by the server over WebSocket */
  authenticatedUserId: string | null;
  /** Subscribes to an event or channel. Returns an unsubscribe function. */
  subscribe: (eventOrChannel: string, callback: WsSubscriptionCallback) => () => void;
  /** Sends a raw or custom event over WebSocket */
  send: (typeOrEvent: string, data?: Record<string, unknown>) => void;
  /** Connects or force-reconnects the WebSocket */
  reconnect: (force?: boolean) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  isConnected: false,
  authenticatedUserId: null,
  subscribe: () => () => {},
  send: () => {},
  reconnect: () => {},
});

function getWebSocketUrl(userId?: string | null): string {
  try {
    const raw = API_URL || "http://localhost:4000";
    const cleaned = raw.replace(/\$\{ELYSIA_PORT\}|\$ELYSIA_PORT/g, "4000");
    const url = new URL(cleaned);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const host = url.host || "localhost:4000";
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return `${protocol}//${host}/ws${query}`;
  } catch {
    const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    return `ws://${host}:4000/ws${query}`;
  }
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [isConnected, setIsConnected] = useState(false);
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<WsSubscriptionCallback>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const isConnectingRef = useRef<boolean>(false);

  // Dispatch incoming event to all subscribed listeners
  const dispatchMessage = useCallback((msg: WsMessage) => {
    // 1. Direct event match (e.g. "notification:new")
    const eventListeners = listenersRef.current.get(msg.event);
    if (eventListeners) {
      eventListeners.forEach((cb) => {
        try {
          cb(msg);
        } catch (e) {
          console.error("[WebSocket] Listener error:", e);
        }
      });
    }

    // 2. Channel match (e.g. "user:123")
    if (msg.channel) {
      const channelListeners = listenersRef.current.get(msg.channel);
      if (channelListeners) {
        channelListeners.forEach((cb) => {
          try {
            cb(msg);
          } catch (e) {
            console.error("[WebSocket] Channel listener error:", e);
          }
        });
      }
    }

    // 3. Catch-all "*" listener
    const globalListeners = listenersRef.current.get("*");
    if (globalListeners) {
      globalListeners.forEach((cb) => {
        try {
          cb(msg);
        } catch (e) {
          console.error("[WebSocket] Global listener error:", e);
        }
      });
    }
  }, []);

  const connect = useCallback((force = false) => {
    if (typeof window === "undefined") return;

    // Do NOT connect if session does not exist unless forced
    if (!force && (status !== "authenticated" || !userId)) {
      return;
    }

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      isConnectingRef.current = true;
      const wsUrl = getWebSocketUrl(userId);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        isConnectingRef.current = false;
        reconnectAttempts.current = 0;

        // Send auth frame immediately if userId is known
        if (userId) {
          ws.send(JSON.stringify({ type: "auth", userId }));
        }

        // Heartbeat ping every 15 seconds
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "auth:success" && data.data?.userId) {
            setAuthenticatedUserId(data.data.userId);
          }
          dispatchMessage(data);
        } catch {
          // Ignore non-JSON frame
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        isConnectingRef.current = false;
        setAuthenticatedUserId(null);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

        // Auto-reconnect ONLY if session exists
        if (status === "authenticated" && userId) {
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000);
          reconnectAttempts.current += 1;
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => connect(false), delay);
        }
      };

      ws.onerror = () => {
        // Handled by onclose
      };
    } catch (err) {
      console.warn("[WebSocket] Connection attempt failed:", err);
      isConnectingRef.current = false;
    }
  }, [dispatchMessage, status, userId]);

  // Handle session lifecycle: connect on login, disconnect on logout
  useEffect(() => {
    if (status === "authenticated" && userId) {
      connect(false);
    } else if (status === "unauthenticated") {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      setAuthenticatedUserId(null);
    }

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [status, userId, connect]);

  const subscribe = useCallback(
    (eventOrChannel: string, callback: WsSubscriptionCallback): (() => void) => {
      let set = listenersRef.current.get(eventOrChannel);
      if (!set) {
        set = new Set();
        listenersRef.current.set(eventOrChannel, set);

        if (
          socketRef.current?.readyState === WebSocket.OPEN &&
          !eventOrChannel.includes(":") &&
          eventOrChannel !== "*"
        ) {
          socketRef.current.send(
            JSON.stringify({ type: "subscribe", channel: eventOrChannel })
          );
        }
      }
      set.add(callback);

      return () => {
        const currentSet = listenersRef.current.get(eventOrChannel);
        if (currentSet) {
          currentSet.delete(callback);
          if (currentSet.size === 0) {
            listenersRef.current.delete(eventOrChannel);
            if (
              socketRef.current?.readyState === WebSocket.OPEN &&
              !eventOrChannel.includes(":") &&
              eventOrChannel !== "*"
            ) {
              socketRef.current.send(
                JSON.stringify({ type: "unsubscribe", channel: eventOrChannel })
              );
            }
          }
        }
      };
    },
    []
  );

  const send = useCallback((typeOrEvent: string, data?: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: typeOrEvent,
          event: typeOrEvent,
          ...data,
        })
      );
    }
  }, []);

  const reconnect = useCallback((force = true) => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    connect(force);
  }, [connect]);

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
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
