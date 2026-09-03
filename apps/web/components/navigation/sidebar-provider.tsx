"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { SidebarProvider as BaseSidebarProvider } from "@workspace/ui/components/sidebar"
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  SidebarPosition,
  SidebarSection,
} from "@/types/sidebar-config"

const POSITION_STORAGE_KEY = "iris-sidebar-position"

export interface SidebarContextType {
  sidebarConfig: SidebarConfig
  setSidebarConfig: (
    config: SidebarConfig | ((prev: SidebarConfig) => SidebarConfig)
  ) => void
  position: SidebarPosition
  setPosition: (pos: SidebarPosition) => void
  getSection: (sectionName: string) => SidebarSection | undefined
  getItem: (sectionName: string, itemLabel: string) => SidebarItem | undefined
  getChild: (
    sectionName: string,
    parentLabel: string,
    childLabel: string
  ) => SidebarItemChild | undefined
  insertSection: (section: SidebarSection, position?: number) => void
  insertItem: (
    sectionName: string,
    item: SidebarItem,
    position?: number
  ) => void
  insertChild: (
    sectionName: string,
    parentLabel: string,
    child: SidebarItemChild,
    position?: number
  ) => void
  removeSection: (sectionName: string) => void
  removeItem: (sectionName: string, itemLabel: string) => void
  removeChild: (
    sectionName: string,
    parentLabel: string,
    childLabel: string
  ) => void
  updateBadge: (
    sectionName: string,
    itemLabel: string,
    badge: string | number
  ) => void
  updateChildBadge: (
    sectionName: string,
    parentLabel: string,
    childLabel: string,
    badge: string | number
  ) => void
}

export const SidebarNavigationContext = createContext<
  SidebarContextType | undefined
>(undefined)

export interface IrisSidebarProviderProps extends React.ComponentProps<
  typeof BaseSidebarProvider
> {
  children: ReactNode
  initialConfig?: SidebarConfig
  defaultPosition?: SidebarPosition
}

export function IrisSidebarProvider({
  children,
  initialConfig = [],
  defaultPosition = "left",
  defaultOpen = true,
  ...sidebarProps
}: IrisSidebarProviderProps) {
  const [sidebarConfig, setSidebarConfig] =
    useState<SidebarConfig>(initialConfig)
  const [position, setPositionState] =
    useState<SidebarPosition>(defaultPosition)

  // Initialize position from localStorage if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem(
        POSITION_STORAGE_KEY
      ) as SidebarPosition | null
      if (stored && ["left", "right", "top", "bottom"].includes(stored)) {
        setPositionState(stored)
      }
    } catch {
      // ignore storage access errors
    }
  }, [])

  const setPosition = useCallback((newPos: SidebarPosition) => {
    setPositionState(newPos)
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, newPos)
      window.dispatchEvent(
        new CustomEvent("iris-sidebar-position-changed", { detail: newPos })
      )
    } catch {
      // ignore
    }
  }, [])

  // Listen for position changes across components
  useEffect(() => {
    const handlePosEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SidebarPosition>
      if (customEvent.detail) {
        setPositionState(customEvent.detail)
      }
    }
    window.addEventListener("iris-sidebar-position-changed", handlePosEvent)
    return () => {
      window.removeEventListener(
        "iris-sidebar-position-changed",
        handlePosEvent
      )
    }
  }, [])

  const getSection = useCallback(
    (sectionName: string) => {
      return sidebarConfig.find(
        (s) => s.dataKey === sectionName || s.section === sectionName
      )
    },
    [sidebarConfig]
  )

  const getItem = useCallback(
    (sectionName: string, itemLabel: string) => {
      return getSection(sectionName)?.items.find(
        (i) => i.dataKey === itemLabel || i.label === itemLabel
      )
    },
    [getSection]
  )

  const getChild = useCallback(
    (sectionName: string, parentLabel: string, childLabel: string) => {
      return getItem(sectionName, parentLabel)?.children?.find(
        (c) => c.dataKey === childLabel || c.label === childLabel
      )
    },
    [getItem]
  )

  const insertSection = useCallback(
    (section: SidebarSection, insertPosition: number = 0) => {
      setSidebarConfig((prev) => {
        const newConfig = [...prev]
        newConfig.splice(insertPosition, 0, section)
        return newConfig
      })
    },
    []
  )

  const insertItem = useCallback(
    (sectionName: string, item: SidebarItem, insertPosition?: number) => {
      setSidebarConfig((prev) =>
        prev.map((s) => {
          if (s.section !== sectionName && s.dataKey !== sectionName) return s
          const newItems = [...s.items]
          const insertIdx =
            insertPosition !== undefined ? insertPosition : newItems.length
          newItems.splice(insertIdx, 0, item)
          return { ...s, items: newItems }
        })
      )
    },
    []
  )

  const insertChild = useCallback(
    (
      sectionName: string,
      parentLabel: string,
      child: SidebarItemChild,
      insertPosition?: number
    ) => {
      setSidebarConfig((prev) =>
        prev.map((s) => {
          if (s.section !== sectionName && s.dataKey !== sectionName) return s
          return {
            ...s,
            items: s.items.map((i) => {
              if (i.label !== parentLabel && i.dataKey !== parentLabel) return i
              const newChildren = [...(i.children || [])]
              const insertIdx =
                insertPosition !== undefined
                  ? insertPosition
                  : newChildren.length
              newChildren.splice(insertIdx, 0, child)
              return { ...i, children: newChildren }
            }),
          }
        })
      )
    },
    []
  )

  const removeSection = useCallback((sectionName: string) => {
    setSidebarConfig((prev) =>
      prev.filter((s) => s.section !== sectionName && s.dataKey !== sectionName)
    )
  }, [])

  const removeItem = useCallback((sectionName: string, itemLabel: string) => {
    setSidebarConfig((prev) =>
      prev.map((s) => {
        if (s.section !== sectionName && s.dataKey !== sectionName) return s
        return {
          ...s,
          items: s.items.filter(
            (i) => i.label !== itemLabel && i.dataKey !== itemLabel
          ),
        }
      })
    )
  }, [])

  const removeChild = useCallback(
    (sectionName: string, parentLabel: string, childLabel: string) => {
      setSidebarConfig((prev) =>
        prev.map((s) => {
          if (s.section !== sectionName && s.dataKey !== sectionName) return s
          return {
            ...s,
            items: s.items.map((i) => {
              if (i.label !== parentLabel && i.dataKey !== parentLabel) return i
              return {
                ...i,
                children: i.children?.filter(
                  (c) => c.label !== childLabel && c.dataKey !== childLabel
                ),
              }
            }),
          }
        })
      )
    },
    []
  )

  const updateBadge = useCallback(
    (sectionName: string, itemLabel: string, badge: string | number) => {
      setSidebarConfig((prev) =>
        prev.map((s) => {
          if (s.section !== sectionName && s.dataKey !== sectionName) return s
          return {
            ...s,
            items: s.items.map((i) =>
              i.label === itemLabel || i.dataKey === itemLabel
                ? { ...i, badge }
                : i
            ),
          }
        })
      )
    },
    []
  )

  const updateChildBadge = useCallback(
    (
      sectionName: string,
      parentLabel: string,
      childLabel: string,
      badge: string | number
    ) => {
      setSidebarConfig((prev) =>
        prev.map((s) => {
          if (s.section !== sectionName && s.dataKey !== sectionName) return s
          return {
            ...s,
            items: s.items.map((i) => {
              if (i.label !== parentLabel && i.dataKey !== parentLabel) return i
              return {
                ...i,
                children: i.children?.map((c) =>
                  c.label === childLabel || c.dataKey === childLabel
                    ? { ...c, badge }
                    : c
                ),
              }
            }),
          }
        })
      )
    },
    []
  )

  const contextValue = useMemo(
    () => ({
      sidebarConfig,
      setSidebarConfig,
      position,
      setPosition,
      getSection,
      getItem,
      getChild,
      insertSection,
      insertItem,
      insertChild,
      removeSection,
      removeItem,
      removeChild,
      updateBadge,
      updateChildBadge,
    }),
    [
      sidebarConfig,
      position,
      setPosition,
      getSection,
      getItem,
      getChild,
      insertSection,
      insertItem,
      insertChild,
      removeSection,
      removeItem,
      removeChild,
      updateBadge,
      updateChildBadge,
    ]
  )

  return (
    <SidebarNavigationContext.Provider value={contextValue}>
      <BaseSidebarProvider defaultOpen={defaultOpen} {...sidebarProps}>
        {children}
      </BaseSidebarProvider>
    </SidebarNavigationContext.Provider>
  )
}

export function useIrisSidebar(config?: SidebarConfig) {
  const context = useContext(SidebarNavigationContext)

  if (context === undefined) {
    throw new Error("useIrisSidebar must be used within an IrisSidebarProvider")
  }

  const { setSidebarConfig } = context

  useEffect(() => {
    if (config && config.length > 0) {
      setSidebarConfig((prev) => {
        if (prev === config) return prev
        return config
      })
    }
  }, [config, setSidebarConfig])

  return context
}
