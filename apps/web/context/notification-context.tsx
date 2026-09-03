"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { elysia } from "@/lib/elysia"
import { useWebSocket } from "./websocket-context"
import { useEncryption } from "./encryption-context"
import { loadSessionSecretKey } from "@/lib/encryption-vault"
import {
  decryptPqeNotification,
  type PqeNotificationContent,
} from "@/lib/encryption-pqe"
import { IrisNotificationToast } from "@/components/navigation/iris-notification-toast"

export type NotificationType =
  "INFO" | "ACTION_CONFIRM" | "ACTION_INPUT" | "ACTION_SELECT"
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT"
export type NotificationActionStatus =
  "PENDING" | "CONFIRMED" | "REJECTED" | "SUBMITTED" | "EXPIRED"

export interface NotificationItem {
  id: string
  userId: string
  app: string
  category: string
  type: NotificationType
  priority: NotificationPriority
  isRead: boolean
  readAt: string | null
  actionStatus: NotificationActionStatus | null
  actionPayload: any
  actionHandler: string | null
  kemCiphertext: string
  encryptedData: string
  expiresAt: string | null
  createdAt: string
  updatedAt: string

  // Decrypted client state
  isDecrypted: boolean
  content: PqeNotificationContent | null
  decryptionError?: string | null
}

export interface NotificationFilterState {
  apps: string[]
  categories: string[]
  types: NotificationType[]
  priorities: NotificationPriority[]
  actionStatus: string
  dateRange: "all" | "today" | "week"
  isRead: "all" | "unread" | "read"
  search: string
}

export interface NotificationContextValue {
  notifications: NotificationItem[]
  filteredNotifications: NotificationItem[]
  unreadCount: number
  isLoading: boolean
  error: string | null

  // Modal open state
  isModalOpen: boolean
  setIsModalOpen: (open: boolean) => void

  // Filters
  filters: NotificationFilterState
  setFilters: React.Dispatch<React.SetStateAction<NotificationFilterState>>
  updateFilter: <K extends keyof NotificationFilterState>(
    key: K,
    value: NotificationFilterState[K]
  ) => void
  toggleFilterItem: <K extends "apps" | "categories" | "types" | "priorities">(
    key: K,
    item: NotificationFilterState[K][number]
  ) => void
  resetFilters: () => void

  // Actions
  markAsRead: (id: string) => Promise<boolean>
  markAllAsRead: () => Promise<boolean>
  deleteNotification: (id: string) => Promise<boolean>
  deleteAllNotifications: (onlyRead?: boolean) => Promise<boolean>
  submitAction: (
    id: string,
    action: string,
    payload?: Record<string, unknown>
  ) => Promise<boolean>
  refresh: () => Promise<void>
  decryptAllPending: () => void
}

const defaultFilters: NotificationFilterState = {
  apps: [],
  categories: [],
  types: [],
  priorities: [],
  actionStatus: "all",
  dateRange: "all",
  isRead: "all",
  search: "",
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  const { subscribe, isConnected } = useWebSocket()
  const { isActive } = useEncryption()

  const [rawNotifications, setRawNotifications] = useState<NotificationItem[]>(
    []
  )
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [filters, setFilters] =
    useState<NotificationFilterState>(defaultFilters)

  const notificationsRef = useRef<NotificationItem[]>([])
  notificationsRef.current = rawNotifications

  // Helper to attempt decrypting a single notification item
  const tryDecryptNotification = useCallback(
    (
      item: NotificationItem,
      secretKey: Uint8Array | null
    ): NotificationItem => {
      if (item.isDecrypted && item.content) return item
      if (!secretKey) {
        return {
          ...item,
          isDecrypted: false,
          content: null,
          decryptionError: null,
        }
      }

      try {
        const content = decryptPqeNotification(
          item.kemCiphertext,
          item.encryptedData,
          secretKey
        )
        return {
          ...item,
          isDecrypted: true,
          content,
          decryptionError: null,
        }
      } catch (err: any) {
        return {
          ...item,
          isDecrypted: false,
          content: null,
          decryptionError: err?.message || "Decryption failed",
        }
      }
    },
    []
  )

  // Decrypt all notifications currently held in state
  const decryptAllWithKey = useCallback(
    (secretKey: Uint8Array | null) => {
      setRawNotifications((prev) =>
        prev.map((item) => tryDecryptNotification(item, secretKey))
      )
    },
    [tryDecryptNotification]
  )

  const decryptAllPending = useCallback(() => {
    const secretKey = loadSessionSecretKey(userId)
    decryptAllWithKey(secretKey)
  }, [userId, decryptAllWithKey])

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    if (status !== "authenticated" || !userId) return

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: apiError } = await elysia.notifications.get({
        fetch: { credentials: "include" },
      })

      if (!apiError && data?.success) {
        const secretKey = loadSessionSecretKey(userId)
        const mapped: NotificationItem[] = (data.notifications || []).map(
          (n: any) => {
            const baseItem: NotificationItem = {
              id: n.id,
              userId: n.userId,
              app: n.app,
              category: n.category,
              type: n.type,
              priority: n.priority,
              isRead: Boolean(n.isRead),
              readAt: n.readAt ? String(n.readAt) : null,
              actionStatus: n.actionStatus ?? null,
              actionPayload: n.actionPayload ?? null,
              actionHandler: n.actionHandler ?? null,
              kemCiphertext: n.kemCiphertext,
              encryptedData: n.encryptedData,
              expiresAt: n.expiresAt ? String(n.expiresAt) : null,
              createdAt: String(n.createdAt),
              updatedAt: String(n.updatedAt),
              isDecrypted: false,
              content: null,
            }
            return tryDecryptNotification(baseItem, secretKey)
          }
        )

        setRawNotifications(mapped)
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch (err: any) {
      console.warn("[NotificationContext] Failed to load notifications:", err)
      setError(err?.message || "Failed to load notifications")
    } finally {
      setIsLoading(false)
    }
  }, [status, userId, tryDecryptNotification])

  // Initial fetch on login
  useEffect(() => {
    if (status === "authenticated" && userId) {
      fetchNotifications()
    } else if (status === "unauthenticated") {
      setRawNotifications([])
      setUnreadCount(0)
    }
  }, [status, userId, fetchNotifications])

  // When encryption vault becomes active (or locked), re-attempt decryption
  useEffect(() => {
    const secretKey = isActive ? loadSessionSecretKey(userId) : null
    decryptAllWithKey(secretKey)
  }, [isActive, userId, decryptAllWithKey])

  // Submit interactive notification action
  const submitAction = useCallback(
    async (
      id: string,
      action: string,
      payload?: Record<string, unknown>
    ): Promise<boolean> => {
      try {
        const { data, error: apiError } = await elysia
          .notifications({ id })
          .action.post(
            { action, payload },
            { fetch: { credentials: "include" } }
          )

        if (!apiError && data?.success) {
          setRawNotifications((prev) =>
            prev.map((n) =>
              n.id === id
                ? {
                    ...n,
                    actionStatus: data.actionStatus as any,
                    actionPayload: data.actionPayload,
                    isRead: true,
                  }
                : n
            )
          )
          setUnreadCount((prev) => Math.max(0, prev - 1))
          return true
        }
        return false
      } catch {
        return false
      }
    },
    []
  )

  // Real-time WebSocket event listeners
  useEffect(() => {
    if (status !== "authenticated") return

    // 1. New incoming notification
    const unsubNew = subscribe("notification:new", (msg) => {
      const raw = msg.data?.notification
      if (!raw) return

      const secretKey = loadSessionSecretKey(userId)
      const baseItem: NotificationItem = {
        id: raw.id,
        userId: raw.userId,
        app: raw.app,
        category: raw.category,
        type: raw.type,
        priority: raw.priority,
        isRead: Boolean(raw.isRead),
        readAt: raw.readAt ? String(raw.readAt) : null,
        actionStatus: raw.actionStatus ?? null,
        actionPayload: raw.actionPayload ?? null,
        actionHandler: raw.actionHandler ?? null,
        kemCiphertext: raw.kemCiphertext,
        encryptedData: raw.encryptedData,
        expiresAt: raw.expiresAt ? String(raw.expiresAt) : null,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        isDecrypted: false,
        content: null,
      }

      const decrypted = tryDecryptNotification(baseItem, secretKey)

      setRawNotifications((prev) => {
        if (prev.some((n) => n.id === decrypted.id)) return prev
        return [decrypted, ...prev]
      })
      setUnreadCount((prev) => prev + 1)

      // Trigger custom interactive popup
      toast.custom(
        (t) => (
          <IrisNotificationToast
            toastId={t}
            item={decrypted}
            onSubmitAction={submitAction}
            onOpenModal={() => setIsModalOpen(true)}
            onDismiss={() => toast.dismiss(t)}
          />
        ),
        {
          duration: decrypted.priority === "URGENT" ? 15000 : 8000,
        }
      )
    })

    // 2. Notification update (e.g. read status)
    const unsubUpdate = subscribe("notification:update", (msg) => {
      const data = msg.data
      if (!data?.id) return

      setRawNotifications((prev) =>
        prev.map((item) =>
          item.id === data.id
            ? {
                ...item,
                isRead: Boolean(data.isRead),
                readAt: data.readAt ? String(data.readAt) : null,
              }
            : item
        )
      )
      if (typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount)
      }
    })

    // 3. Action resolved
    const unsubAction = subscribe("notification:action-resolved", (msg) => {
      const data = msg.data
      if (!data?.id) return

      setRawNotifications((prev) =>
        prev.map((item) =>
          item.id === data.id
            ? {
                ...item,
                actionStatus: data.actionStatus,
                actionPayload: data.actionPayload,
                isRead: Boolean(data.isRead),
              }
            : item
        )
      )
      if (typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount)
      }
    })

    // 4. Single delete
    const unsubDelete = subscribe("notification:delete", (msg) => {
      const data = msg.data
      if (!data?.id) return

      setRawNotifications((prev) => prev.filter((item) => item.id !== data.id))
      if (typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount)
      }
    })

    // 5. Bulk delete
    const unsubBulkDelete = subscribe("notification:bulk-delete", (msg) => {
      const data = msg.data
      if (typeof data?.unreadCount === "number") {
        setUnreadCount(data.unreadCount)
      }
      fetchNotifications()
    })

    // 6. Mark all read
    const unsubMarkAll = subscribe("notification:mark-all-read", () => {
      setRawNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          isRead: true,
          readAt: new Date().toISOString(),
        }))
      )
      setUnreadCount(0)
    })

    return () => {
      unsubNew()
      unsubUpdate()
      unsubAction()
      unsubDelete()
      unsubBulkDelete()
      unsubMarkAll()
    }
  }, [status, userId, subscribe, tryDecryptNotification, fetchNotifications])

  // Actions
  const markAsRead = async (id: string): Promise<boolean> => {
    try {
      const target = rawNotifications.find((n) => n.id === id)
      if (target?.isRead) return true

      // Optimistic update
      setRawNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      const { data, error: apiError } = await elysia
        .notifications({ id })
        .read.patch({ isRead: true }, { fetch: { credentials: "include" } })

      return !apiError && Boolean(data?.success)
    } catch {
      return false
    }
  }

  const markAllAsRead = async (): Promise<boolean> => {
    try {
      setRawNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        }))
      )
      setUnreadCount(0)

      const { data, error: apiError } = await elysia.notifications[
        "mark-all-read"
      ].post({}, { fetch: { credentials: "include" } })

      return !apiError && Boolean(data?.success)
    } catch {
      return false
    }
  }

  const deleteNotification = async (id: string): Promise<boolean> => {
    try {
      const target = rawNotifications.find((n) => n.id === id)
      setRawNotifications((prev) => prev.filter((n) => n.id !== id))
      if (target && !target.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }

      const { data, error: apiError } = await elysia
        .notifications({ id })
        .delete({}, { fetch: { credentials: "include" } })

      return !apiError && Boolean(data?.success)
    } catch {
      return false
    }
  }

  const deleteAllNotifications = async (onlyRead = false): Promise<boolean> => {
    try {
      if (onlyRead) {
        setRawNotifications((prev) => prev.filter((n) => !n.isRead))
      } else {
        setRawNotifications([])
        setUnreadCount(0)
      }

      const { data, error: apiError } = await elysia.notifications.delete(
        { query: { onlyRead: onlyRead ? "true" : undefined } },
        { fetch: { credentials: "include" } }
      )

      return !apiError && Boolean(data?.success)
    } catch {
      return false
    }
  }

  const updateFilter = useCallback(
    <K extends keyof NotificationFilterState>(
      key: K,
      value: NotificationFilterState[K]
    ) => {
      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const toggleFilterItem = useCallback(
    <K extends "apps" | "categories" | "types" | "priorities">(
      key: K,
      item: NotificationFilterState[K][number]
    ) => {
      setFilters((prev) => {
        const list = prev[key] as any[]
        const exists = list.includes(item)
        const next = exists ? list.filter((x) => x !== item) : [...list, item]
        return { ...prev, [key]: next }
      })
    },
    []
  )

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [])

  // Filtered notifications list
  const filteredNotifications = useMemo(() => {
    return rawNotifications.filter((item) => {
      // 1. App multi-filter
      if (
        filters.apps.length > 0 &&
        !filters.apps.some((a) => a.toLowerCase() === item.app.toLowerCase())
      ) {
        return false
      }

      // 2. Category multi-filter
      if (
        filters.categories.length > 0 &&
        !filters.categories.some(
          (c) => c.toLowerCase() === item.category.toLowerCase()
        )
      ) {
        return false
      }

      // 3. Type multi-filter
      if (filters.types.length > 0 && !filters.types.includes(item.type)) {
        return false
      }

      // 4. Priority multi-filter
      if (
        filters.priorities.length > 0 &&
        !filters.priorities.includes(item.priority)
      ) {
        return false
      }

      // 5. Action Status filter
      if (filters.actionStatus !== "all") {
        if (
          filters.actionStatus === "pending" &&
          item.actionStatus !== "PENDING"
        ) {
          return false
        }
        if (
          filters.actionStatus === "resolved" &&
          (!item.actionStatus || item.actionStatus === "PENDING")
        ) {
          return false
        }
      }

      // 6. Read filter
      if (filters.isRead === "unread" && item.isRead) return false
      if (filters.isRead === "read" && !item.isRead) return false

      // 7. Date Range filter
      if (filters.dateRange !== "all") {
        const itemDate = new Date(item.createdAt).getTime()
        const now = Date.now()
        if (filters.dateRange === "today") {
          const oneDay = 24 * 60 * 60 * 1000
          if (now - itemDate > oneDay) return false
        } else if (filters.dateRange === "week") {
          const sevenDays = 7 * 24 * 60 * 60 * 1000
          if (now - itemDate > sevenDays) return false
        }
      }

      // 8. Search query (matches decrypted title/body, app name, category)
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase().trim()
        const appMatch = item.app.toLowerCase().includes(q)
        const catMatch = item.category.toLowerCase().includes(q)
        const titleMatch = item.content?.title.toLowerCase().includes(q)
        const bodyMatch = item.content?.body.toLowerCase().includes(q)

        if (!appMatch && !catMatch && !titleMatch && !bodyMatch) {
          return false
        }
      }

      return true
    })
  }, [rawNotifications, filters])

  return (
    <NotificationContext.Provider
      value={{
        notifications: rawNotifications,
        filteredNotifications,
        unreadCount,
        isLoading,
        error,
        isModalOpen,
        setIsModalOpen,
        filters,
        setFilters,
        updateFilter,
        toggleFilterItem,
        resetFilters,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        submitAction,
        refresh: fetchNotifications,
        decryptAllPending,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    )
  }
  return context
}
