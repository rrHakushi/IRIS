"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import {
  type BrowseCategory,
  type BrowseHistoryStore,
  type VisitedMediaItem,
  type CategoryBrowseHistory,
  getStoredBrowseHistory,
  addBrowseQueryToStore,
  addBrowseVisitToStore,
  removeBrowseQueryFromStore,
  removeBrowseVisitFromStore,
  clearCategoryHistoryFromStore,
  clearAllBrowseHistoryFromStore,
  SERVER_BROWSE_HISTORY_SNAPSHOT,
  BROWSE_HISTORY_EVENT,
} from "@/lib/browse-history"

// Shared cached snapshot for useSyncExternalStore in browser
let cachedStore: BrowseHistoryStore = SERVER_BROWSE_HISTORY_SNAPSHOT
let isInitialized = false

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {}

  const handleUpdate = () => {
    cachedStore = getStoredBrowseHistory()
    callback()
  }

  window.addEventListener(BROWSE_HISTORY_EVENT, handleUpdate)
  window.addEventListener("storage", handleUpdate)

  return () => {
    window.removeEventListener(BROWSE_HISTORY_EVENT, handleUpdate)
    window.removeEventListener("storage", handleUpdate)
  }
}

function getSnapshot(): BrowseHistoryStore {
  if (typeof window === "undefined") {
    return SERVER_BROWSE_HISTORY_SNAPSHOT
  }
  if (!isInitialized) {
    cachedStore = getStoredBrowseHistory()
    isInitialized = true
  }
  return cachedStore
}

function getServerSnapshot(): BrowseHistoryStore {
  return SERVER_BROWSE_HISTORY_SNAPSHOT
}

export function useBrowseHistory() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const getCategoryHistory = useCallback(
    (category: BrowseCategory): CategoryBrowseHistory => {
      return (
        store[category] || {
          recentBrowseQueries: [],
          recentBrowseVisits: [],
        }
      )
    },
    [store]
  )

  const addQuery = useCallback((category: BrowseCategory, query: string) => {
    addBrowseQueryToStore(category, query)
  }, [])

  const addVisit = useCallback(
    (
      category: BrowseCategory,
      item: Omit<VisitedMediaItem, "visitedAt"> & { visitedAt?: number }
    ) => {
      addBrowseVisitToStore(category, item)
    },
    []
  )

  const removeQuery = useCallback((category: BrowseCategory, query: string) => {
    removeBrowseQueryFromStore(category, query)
  }, [])

  const removeVisit = useCallback(
    (category: BrowseCategory, id: number | string) => {
      removeBrowseVisitFromStore(category, id)
    },
    []
  )

  const clearCategory = useCallback((category: BrowseCategory) => {
    clearCategoryHistoryFromStore(category)
  }, [])

  const clearAll = useCallback(() => {
    clearAllBrowseHistoryFromStore()
  }, [])

  return {
    history: store,
    isLoaded: mounted,
    getCategoryHistory,
    addQuery,
    addVisit,
    removeQuery,
    removeVisit,
    clearCategory,
    clearAll,
  }
}
