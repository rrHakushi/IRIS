"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Slider } from "@workspace/ui/components/slider"
import { Popover, PopoverTrigger } from "@workspace/ui/components/popover"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { toast } from "sonner"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@workspace/ui/components/sidebar"
import {
  IconGripVertical,
  IconPlus,
  IconTrash,
  IconX,
  IconSearch,
  IconFolder,
  IconFolders,
  IconLink,
  IconExternalLink,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconArrowsHorizontal,
  IconRotate2,
  IconInbox,
  IconPencil,
  IconArrowsExchange,
} from "@tabler/icons-react"
import type {
  SidebarConfig,
  SidebarItem,
  SidebarItemChild,
  SidebarSection,
  SidebarPosition,
  AppSidebarCustomization,
  CustomSidebarGroup,
  CustomSidebarItem,
} from "@/types/sidebar-config"
import type { AppSidebarRegistryEntry } from "@/config/sidebars"
import { getItemKey, getSectionKey } from "@/lib/navigation"
import { renderDockGroupIcon } from "@/config/dock-group-icons"
import { IrisAppMenu } from "../../../iris-app-menu"
import { IrisUserMenu } from "../../../iris-user-menu"

function normalizePath(path: string): string {
  if (!path) return "/"
  const trimmed = path.replace(/\/+$/, "")
  return trimmed === "" ? "/" : trimmed
}

function isRouteActive(currentPath: string, href?: string): boolean {
  if (!href || href === "#") return false
  const path = normalizePath(currentPath)
  const target = normalizePath(href)
  if (path === target) return true
  const segments = target.split("/").filter(Boolean)
  if (segments.length <= 1) return false
  return path.startsWith(`${target}/`)
}

export interface SidebarCanvasEditorProps {
  appId: string
  appName: string
  position: SidebarPosition
  configuredSections: SidebarConfig
  customization: AppSidebarCustomization
  allAppConfigs: AppSidebarRegistryEntry[]
  onChangeCustomization: (updated: AppSidebarCustomization) => void
  onOpenCreateGroup: () => void
  onOpenEditGroup: (group: CustomSidebarGroup) => void
  onOpenCreateLink: () => void
  onResetLayout: () => void
}

interface DragPayload {
  type: "sidebar-item" | "inventory-item" | "section" | "sidebar-child"
  key: string
  sourceSectionKey?: string
  sourceParentKey?: string
  label: string
  icon?: string
}

interface InventoryItem {
  key: string
  label: string
  icon?: React.ReactNode
  iconName?: string
  appName: string
  sectionName?: string
  type: "shortcut" | "group" | "link"
  groupData?: CustomSidebarGroup
  linkData?: CustomSidebarItem
  children?: SidebarItemChild[]
}

export function SidebarCanvasEditor({
  appId,
  appName,
  position,
  configuredSections,
  customization,
  allAppConfigs,
  onChangeCustomization,
  onOpenCreateGroup,
  onOpenEditGroup,
  onOpenCreateLink,
  onResetLayout,
}: SidebarCanvasEditorProps): React.JSX.Element {
  const t = useTranslations("navigation.sidebarSettings")
  const pathname = usePathname() || "/"

  const isRight = position === "right"
  const isHorizontal = position === "top" || position === "bottom"

  // Drag and Drop active tracking
  const [dragged, setDragged] = useState<DragPayload | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    type: "section" | "item" | "inventory-dropzone" | "section-zone"
    key: string
    position?: "before" | "after" | "inside"
  } | null>(null)

  // Track currently open dropdown section in horizontal navbar mode
  const [openDropdownSecKey, setOpenDropdownSecKey] = useState<string | null>(
    null
  )

  // Horizontal editor navbar scroll & slider state
  const editorNavRef = useRef<HTMLElement | null>(null)
  const [navScrollState, setNavScrollState] = useState({
    scrollLeft: 0,
    maxScroll: 0,
    hasOverflow: false,
  })

  const updateNavScroll = useCallback(() => {
    const el = editorNavRef.current
    if (!el) return
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    setNavScrollState({
      scrollLeft: el.scrollLeft,
      maxScroll: max,
      hasOverflow: max > 2,
    })
  }, [])

  useEffect(() => {
    updateNavScroll()
    const el = editorNavRef.current
    if (!el) return
    const observer = new ResizeObserver(() => updateNavScroll())
    observer.observe(el)
    return () => observer.disconnect()
  }, [updateNavScroll, configuredSections])

  // Merge modal state when 2 items are dragged onto each other
  const [mergeModal, setMergeModal] = useState<{
    sourceItem: { key: string; label: string; icon?: string }
    targetItem: { key: string; label: string; icon?: string }
    targetSectionKey: string
  } | null>(null)
  const [mergeGroupName, setMergeGroupName] = useState("")
  const [mergeGroupType, setMergeGroupType] = useState<"section" | "folder">(
    "section"
  )

  // Merge sections modal state when 2 sections are dragged onto each other
  const [mergeSectionsModal, setMergeSectionsModal] = useState<{
    sourceSecKey: string
    targetSecKey: string
    sourceTitle: string
    targetTitle: string
  } | null>(null)
  const [mergedSectionName, setMergedSectionName] = useState("")

  // Direct Add Section dialog state
  const [addSectionOpen, setAddSectionOpen] = useState(false)
  const [newSectionName, setNewSectionName] = useState("")

  // Rename Section dialog state
  const [renameModal, setRenameModal] = useState<{
    sectionKey: string
    currentTitle: string
  } | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // Global dragend cleanup listener
  React.useEffect(() => {
    const handleGlobalDragEnd = () => {
      setDragged(null)
      setDropTarget(null)
    }
    window.addEventListener("dragend", handleGlobalDragEnd)
    window.addEventListener("drop", handleGlobalDragEnd)
    return () => {
      window.removeEventListener("dragend", handleGlobalDragEnd)
      window.removeEventListener("drop", handleGlobalDragEnd)
    }
  }, [])

  // Expand state for folder items and sections
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({})
  const [openFolderItems, setOpenFolderItems] = useState<Record<string, boolean>>(
    {}
  )

  // Inventory search filter state
  const [inventorySearch, setInventorySearch] = useState("")

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: prev[key] !== undefined ? !prev[key] : false,
    }))
  }

  const toggleFolderItem = (key: string) => {
    setOpenFolderItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // Set of all item keys currently present in the active sidebar sections
  const activeSidebarItemKeys = useMemo(() => {
    const set = new Set<string>()
    configuredSections.forEach((sec) => {
      const sKey = getSectionKey(sec)
      if (sKey) {
        set.add(sKey)
        if (sKey.startsWith("group-sec:")) {
          set.add(`group-folder:${sKey.replace("group-sec:", "")}`)
        }
      }
      sec.items.forEach((it) => {
        const itKey = getItemKey(it)
        if (itKey) {
          set.add(itKey)
          if (itKey.startsWith("group-folder:")) {
            set.add(`group-sec:${itKey.replace("group-folder:", "")}`)
          }
        }
        if (it.children) {
          it.children.forEach((c) => {
            const cKey = getItemKey(c)
            if (cKey) set.add(cKey)
          })
        }
      })
    })

    // Also register custom group IDs and their assigned items so they don't leak into inventory
    if (customization.customGroups) {
      customization.customGroups.forEach((g) => {
        set.add(`group-sec:${g.id}`)
        set.add(`group-folder:${g.id}`)
        g.itemKeys.forEach((k) => set.add(k))
      })
    }

    return set
  }, [configuredSections, customization.customGroups])

  // Extract all available inventory shortcuts from all apps
  const allAvailableInventory = useMemo((): InventoryItem[] => {
    const list: InventoryItem[] = []
    const seen = new Set<string>()

    const isMobileOrPhone = (keyOrTitle?: string) => {
      if (!keyOrTitle) return false
      const lower = keyOrTitle.toLowerCase()
      return (
        lower.includes("#$") ||
        lower.includes("mobile-dock") ||
        lower.includes("phone-dock") ||
        lower.startsWith("phone-") ||
        lower.startsWith("mobile-")
      )
    }

    // 1. App shortcuts from all registered apps
    allAppConfigs.forEach((app) => {
      app.config.forEach((section) => {
        if (isMobileOrPhone(section.section) || isMobileOrPhone(section.dataKey)) return

        section.items.forEach((item: SidebarItem) => {
          if ((item.position ?? 0) < 0) return
          if (isMobileOrPhone(item.dataKey) || isMobileOrPhone(item.label)) return
          if (!item.label || item.label.trim() === "") return

          const mainKey = getItemKey(item)
          if (mainKey && !seen.has(mainKey) && !activeSidebarItemKeys.has(mainKey)) {
            seen.add(mainKey)
            list.push({
              key: mainKey,
              label: item.label,
              icon: item.icon,
              appName: app.appName,
              sectionName: section.section,
              type: "shortcut",
              children: item.children,
            })
          }
        })
      })
    })

    // 2. Custom Groups (only user-named custom groups, skip unnamed single-item wrappers)
    if (customization.customGroups) {
      customization.customGroups.forEach((g) => {
        if (!g.label || g.label.trim() === "") return

        const gKey =
          g.type === "section" ? `group-sec:${g.id}` : `group-folder:${g.id}`
        if (!seen.has(gKey) && !activeSidebarItemKeys.has(gKey)) {
          seen.add(gKey)
          list.push({
            key: gKey,
            label: g.label,
            icon: renderDockGroupIcon(g.icon, "size-4 text-primary"),
            iconName: g.icon,
            appName: t("customBadge"),
            sectionName:
              g.type === "section" ? t("typeSection") : t("typeFolder"),
            type: "group",
            groupData: g,
          })
        }
      })
    }

    // 3. Custom Links
    if (customization.customLinks) {
      customization.customLinks.forEach((l) => {
        if (!l.label || l.label.trim() === "") return
        const lKey = `link:${l.id}`
        if (!seen.has(lKey) && !activeSidebarItemKeys.has(lKey)) {
          seen.add(lKey)
          list.push({
            key: lKey,
            label: l.label,
            icon: renderDockGroupIcon(l.icon || "pin", "size-4 text-primary"),
            iconName: l.icon || "pin",
            appName: t("customBadge"),
            sectionName: l.href,
            type: "link",
            linkData: l,
          })
        }
      })
    }

    // 4. Hidden base sections available to restore from inventory
    if (customization.hiddenSections && customization.hiddenSections.length > 0) {
      customization.hiddenSections.forEach((hSecKey) => {
        if (isMobileOrPhone(hSecKey)) return

        const origSec = allAppConfigs
          .flatMap((a) => a.config)
          .find((s) => getSectionKey(s) === hSecKey)
        const label = origSec?.section || hSecKey
        if (isMobileOrPhone(label) || !label || label.trim() === "") return

        const key = `hidden-sec:${hSecKey}`
        if (!seen.has(key)) {
          seen.add(key)
          list.push({
            key,
            label: `${label} (Section)`,
            icon: <IconFolders className="size-4 text-primary" />,
            appName: "Section",
            sectionName: "Hidden Section",
            type: "group",
          })
        }
      })
    }

    return list
  }, [allAppConfigs, customization.customGroups, customization.customLinks, customization.hiddenSections, activeSidebarItemKeys, t])

  // Filtered inventory items: EXCLUDE items already present in the active sidebar and blank items
  const filteredInventory = useMemo(() => {
    return allAvailableInventory.filter((item) => {
      // Exclude items with empty labels
      if (!item.label || item.label.trim() === "") return false

      // Exclude items already in use in the sidebar
      if (activeSidebarItemKeys.has(item.key)) return false

      // Search filter
      if (inventorySearch.trim()) {
        const q = inventorySearch.toLowerCase().trim()
        const matchLabel = item.label.toLowerCase().includes(q)
        const matchApp = item.appName.toLowerCase().includes(q)
        const matchSec = item.sectionName?.toLowerCase().includes(q)
        if (!matchLabel && !matchApp && !matchSec) return false
      }

      return true
    })
  }, [allAvailableInventory, activeSidebarItemKeys, inventorySearch])

  // ==================== DRAG & DROP HANDLERS ====================

  const handleDragStart = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData("application/iris-dnd", JSON.stringify(payload))
    e.dataTransfer.effectAllowed = "move"
    setDragged(payload)
  }

  const handleDragEnd = () => {
    setDragged(null)
    setDropTarget(null)
  }

  // --- Create New Section Directly ---
  const handleCreateNewSection = (name?: string) => {
    const title = (name || newSectionName).trim()
    if (!title) return

    const newGroupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newGroup: CustomSidebarGroup = {
      id: newGroupId,
      label: title,
      icon: "folders",
      type: "section",
      itemKeys: [],
    }

    const secKey = `group-sec:${newGroupId}`
    const updatedGroups = [...(customization.customGroups || []), newGroup]
    const updatedSectionOrder = [...(customization.sectionOrder || [])]
    if (!updatedSectionOrder.includes(secKey)) {
      updatedSectionOrder.push(secKey)
    }

    const updatedItemOrder = { ...(customization.itemOrder || {}) }
    updatedItemOrder[secKey] = []

    onChangeCustomization({
      ...customization,
      customGroups: updatedGroups,
      sectionOrder: updatedSectionOrder,
      itemOrder: updatedItemOrder,
    })

    setNewSectionName("")
    setAddSectionOpen(false)
    toast.success(`Section "${title}" added`)
  }

  // --- Insert item as a single-item section at a given sectionOrder position ---
  const handleInsertItemAtSectionIndex = (
    itemKey: string,
    targetSecKey?: string,
    position?: "before" | "after",
    targetSectionIndex?: number,
    sourceSectionKey?: string
  ) => {
    // 1. If item is already in an unnamed single-item section, just move that section!
    const sourceCustomGroup = (customization.customGroups || []).find(
      (cg) =>
        cg.type === "section" &&
        cg.label === "" &&
        cg.itemKeys.length === 1 &&
        cg.itemKeys[0] === itemKey
    )

    let updatedGroups = [...(customization.customGroups || [])]
    let updatedSectionOrder = configuredSections
      .filter((s) => !s.section?.startsWith("#$"))
      .map((s) => getSectionKey(s))
    const newItemOrder = { ...(customization.itemOrder || {}) }
    const newItemOverrides = { ...(customization.itemOverrides || {}) }

    let secKey: string

    if (sourceCustomGroup) {
      secKey = `group-sec:${sourceCustomGroup.id}`
      const fromIdx = updatedSectionOrder.indexOf(secKey)
      if (fromIdx >= 0) {
        updatedSectionOrder.splice(fromIdx, 1)
      }
    } else {
      const newGroupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      secKey = `group-sec:${newGroupId}`
      const newGroup: CustomSidebarGroup = {
        id: newGroupId,
        label: "",
        icon: "folders",
        type: "section",
        itemKeys: [itemKey],
      }
      updatedGroups.push(newGroup)

      // Remove item from source section
      if (sourceSectionKey && sourceSectionKey !== secKey) {
        const sourceSection = configuredSections.find(
          (s) => getSectionKey(s) === sourceSectionKey
        )
        const currentSourceItems =
          newItemOrder[sourceSectionKey] !== undefined
            ? [...newItemOrder[sourceSectionKey]]
            : sourceSection
              ? sourceSection.items.map((it) => getItemKey(it))
              : []
        newItemOrder[sourceSectionKey] = currentSourceItems.filter((k) => k !== itemKey)
      }
    }

    // Accurately compute insert index after removing the moved section
    let insertIdx: number
    if (targetSecKey) {
      const toSecIdx = updatedSectionOrder.indexOf(targetSecKey)
      if (toSecIdx >= 0) {
        insertIdx = position === "after" ? toSecIdx + 1 : toSecIdx
      } else {
        insertIdx = targetSectionIndex !== undefined ? targetSectionIndex : updatedSectionOrder.length
      }
    } else if (targetSectionIndex !== undefined) {
      insertIdx = targetSectionIndex
    } else {
      insertIdx = updatedSectionOrder.length
    }

    if (insertIdx > updatedSectionOrder.length) insertIdx = updatedSectionOrder.length
    if (insertIdx < 0) insertIdx = 0
    updatedSectionOrder.splice(insertIdx, 0, secKey)

    newItemOrder[secKey] = [itemKey]
    newItemOverrides[itemKey] = { sectionKey: secKey }

    // Prune empty unnamed groups
    updatedGroups = updatedGroups
      .map((cg) => {
        if (`group-sec:${cg.id}` !== secKey && cg.itemKeys.includes(itemKey)) {
          return { ...cg, itemKeys: cg.itemKeys.filter((k) => k !== itemKey) }
        }
        return cg
      })
      .filter((cg) => `group-sec:${cg.id}` === secKey || cg.label.trim() !== "" || cg.itemKeys.length > 0)

    const activeGroupSecKeys = new Set(updatedGroups.map((g) => `group-sec:${g.id}`))
    const finalSectionOrder = updatedSectionOrder.filter(
      (sKey) => !sKey.startsWith("group-sec:") || activeGroupSecKeys.has(sKey)
    )

    const newHiddenItems = (customization.hiddenItems || []).filter(
      (k) => k !== itemKey
    )

    onChangeCustomization({
      ...customization,
      customGroups: updatedGroups,
      sectionOrder: finalSectionOrder,
      itemOrder: newItemOrder,
      itemOverrides: newItemOverrides,
      hiddenItems: newHiddenItems,
    })

    toast.success("Item positioned")
  }

  // --- Drop on navbar or sidebar (creates/positions a section with no name [single item]) ---
  const handleDropToNewSection = (
    explicitPayload?: DragPayload | null,
    targetSecKey?: string,
    position?: "before" | "after",
    targetSectionIndex?: number
  ) => {
    let payload: DragPayload | null = explicitPayload || dragged
    setDragged(null)
    setDropTarget(null)

    if (!payload) return
    const { key, type } = payload
    if (type !== "sidebar-item" && type !== "inventory-item") return

    handleInsertItemAtSectionIndex(
      key,
      targetSecKey,
      position,
      targetSectionIndex,
      payload.sourceSectionKey
    )
  }

  // --- Rename Section Handlers ---
  const handleStartRenameSection = (secKey: string, currentTitle: string) => {
    setRenameModal({ sectionKey: secKey, currentTitle })
    setRenameValue(currentTitle)
  }

  const handleConfirmRename = () => {
    if (!renameModal) return
    const { sectionKey } = renameModal
    const newTitle = renameValue.trim()

    if (sectionKey.startsWith("group-sec:")) {
      const groupId = sectionKey.replace("group-sec:", "")
      const updatedGroups = (customization.customGroups || []).map((cg) => {
        if (cg.id === groupId) {
          return { ...cg, label: newTitle }
        }
        return cg
      })
      onChangeCustomization({
        ...customization,
        customGroups: updatedGroups,
      })
      toast.success(newTitle ? `Renamed to "${newTitle}"` : "Section converted to single")
    } else {
      toast.info("Base section titles are system defaults")
    }

    setRenameModal(null)
  }

  // --- Drop on Section (adds to section or moves item/section) ---
  const handleDropOnSection = (
    e: React.DragEvent | null,
    targetSecKey: string,
    targetIndex?: number,
    explicitPayload?: DragPayload | null,
    position?: "before" | "after" | "inside",
    targetItemKey?: string
  ) => {
    if (e?.preventDefault) e.preventDefault()
    if (e?.stopPropagation) e.stopPropagation()

    let payload: DragPayload | null = explicitPayload || dragged
    if (!payload && e?.dataTransfer) {
      const raw = e.dataTransfer.getData("application/iris-dnd")
      if (raw) {
        try {
          payload = JSON.parse(raw)
        } catch {}
      }
    }

    setDragged(null)
    setDropTarget(null)

    if (!payload) return

    const { key, type } = payload

    // Restore hidden section if dragged from inventory
    if (key.startsWith("hidden-sec:")) {
      const restoredSecKey = key.replace("hidden-sec:", "")
      const updatedHidden = (customization.hiddenSections || []).filter(
        (k) => k !== restoredSecKey
      )
      const updatedOrder = [...(customization.sectionOrder || [])]
      if (!updatedOrder.includes(restoredSecKey)) {
        updatedOrder.push(restoredSecKey)
      }
      onChangeCustomization({
        ...customization,
        hiddenSections: updatedHidden,
        sectionOrder: updatedOrder,
      })
      toast.success(t("customGroupSaved"))
      return
    }

    // 1. Section reordering & merging
    if (type === "section") {
      if (key === targetSecKey) return

      if (position === "inside" || (!position && targetIndex === undefined)) {
        handleStartMergeSections(key, targetSecKey)
        return
      }

      const currentOrder = configuredSections
        .filter((s) => !s.section?.startsWith("#$"))
        .map((s) => getSectionKey(s))
      const fromIdx = currentOrder.indexOf(key)
      if (fromIdx >= 0) {
        const updated = [...currentOrder]
        const [moved] = updated.splice(fromIdx, 1)
        const toIdx = updated.indexOf(targetSecKey)
        if (moved && toIdx >= 0) {
          const insertIdx = position === "after" ? toIdx + 1 : toIdx
          updated.splice(insertIdx, 0, moved)
          onChangeCustomization({
            ...customization,
            sectionOrder: updated,
          })
          toast.success("Section reordered")
        }
      }
      return
    }

    // 2. Dragging an item (sidebar-item or inventory-item)
    const targetSection = configuredSections.find(
      (s) => getSectionKey(s) === targetSecKey
    )
    if (!targetSection) return

    const sourceSectionKey =
      payload.sourceSectionKey ||
      configuredSections.find((s) =>
        s.items.some((it) => getItemKey(it) === key)
      )?.dataKey ||
      configuredSections.find((s) =>
        s.items.some((it) => getItemKey(it) === key)
      )?.section

    // 2A. Dropping before or after an entire section in navbar/sidebar:
    // If targetItemKey is not specified OR targetSection is an unnamed section,
    // position this item before or after this section in sectionOrder!
    const isTargetUnnamedSection =
      !targetSection.section || targetSection.section.trim() === ""
    if (
      (!targetItemKey || isTargetUnnamedSection) &&
      (position === "before" || position === "after")
    ) {
      handleInsertItemAtSectionIndex(
        key,
        targetSecKey,
        position,
        undefined,
        sourceSectionKey
      )
      return
    }

    // 2B. Reordering within section (or adding into a dropdown)
    const currentTargetItems =
      customization.itemOrder?.[targetSecKey] !== undefined
        ? [...customization.itemOrder[targetSecKey]]
        : targetSection.items.map((it) => getItemKey(it))

    let newTargetItems = [...currentTargetItems]
    const newItemOrder = { ...(customization.itemOrder || {}) }
    const newItemOverrides = { ...(customization.itemOverrides || {}) }

    // If item was in another section, remove it from that section's itemOrder
    if (sourceSectionKey && sourceSectionKey !== targetSecKey) {
      const sourceSection = configuredSections.find(
        (s) => getSectionKey(s) === sourceSectionKey
      )
      const currentSourceItems =
        newItemOrder[sourceSectionKey] !== undefined
          ? [...newItemOrder[sourceSectionKey]]
          : sourceSection
            ? sourceSection.items.map((it) => getItemKey(it))
            : []
      newItemOrder[sourceSectionKey] = currentSourceItems.filter((k) => k !== key)
    }

    // Remove from target if already present (reordering within section)
    const fromIdx = newTargetItems.indexOf(key)
    if (fromIdx >= 0) {
      newTargetItems.splice(fromIdx, 1)
    }

    // Calculate insert position accurately
    let insertIdx: number
    if (targetItemKey && (position === "before" || position === "after")) {
      const toItemIdx = newTargetItems.indexOf(targetItemKey)
      if (toItemIdx >= 0) {
        insertIdx = position === "after" ? toItemIdx + 1 : toItemIdx
      } else {
        insertIdx = targetIndex !== undefined ? targetIndex : newTargetItems.length
      }
    } else {
      insertIdx = targetIndex !== undefined ? targetIndex : newTargetItems.length
    }

    if (insertIdx > newTargetItems.length) insertIdx = newTargetItems.length
    if (insertIdx < 0) insertIdx = 0

    newTargetItems.splice(insertIdx, 0, key)
    newItemOrder[targetSecKey] = newTargetItems
    newItemOverrides[key] = { sectionKey: targetSecKey }

    const newHiddenItems = (customization.hiddenItems || []).filter(
      (k) => k !== key
    )

    // Update customGroups: if moving out of a group, remove it; if moving into a custom group section, add it!
    let updatedCustomGroups = (customization.customGroups || []).map((cg) => {
      const gSecKey = `group-sec:${cg.id}`
      if (gSecKey === targetSecKey) {
        if (!cg.itemKeys.includes(key)) {
          return { ...cg, itemKeys: [...cg.itemKeys, key] }
        }
      } else if (sourceSectionKey === gSecKey) {
        return { ...cg, itemKeys: cg.itemKeys.filter((k) => k !== key) }
      }
      return cg
    })

    updatedCustomGroups = updatedCustomGroups.filter(
      (cg) => cg.label.trim() !== "" || cg.itemKeys.length > 0
    )
    const activeGroupKeys = new Set(updatedCustomGroups.map((g) => `group-sec:${g.id}`))
    const finalSectionOrder = (customization.sectionOrder || []).filter(
      (sKey) => !sKey.startsWith("group-sec:") || activeGroupKeys.has(sKey)
    )

    onChangeCustomization({
      ...customization,
      customGroups: updatedCustomGroups,
      sectionOrder: finalSectionOrder,
      itemOrder: newItemOrder,
      itemOverrides: newItemOverrides,
      hiddenItems: newHiddenItems,
    })

    if (openDropdownSecKey && sourceSectionKey !== targetSecKey) {
      setOpenDropdownSecKey(null)
    }

    toast.success("Item moved")
  }

  // --- Remove Section from Sidebar ---
  const handleRemoveSection = (secKey: string) => {
    if (secKey.startsWith("group-sec:")) {
      const groupId = secKey.replace("group-sec:", "")
      const updatedGroups = (customization.customGroups || []).filter(
        (g) => g.id !== groupId
      )
      const updatedOrder = (customization.sectionOrder || []).filter(
        (k) => k !== secKey
      )
      onChangeCustomization({
        ...customization,
        customGroups: updatedGroups,
        sectionOrder: updatedOrder,
      })
      if (openDropdownSecKey === secKey) {
        setOpenDropdownSecKey(null)
      }
      toast.info(t("removeFromSidebar"))
      return
    }

    const hidden = customization.hiddenSections || []
    const updatedHidden = hidden.includes(secKey)
      ? hidden
      : [...hidden, secKey]

    const updatedOrder = (customization.sectionOrder || []).filter(
      (k) => k !== secKey
    )

    onChangeCustomization({
      ...customization,
      hiddenSections: updatedHidden,
      sectionOrder: updatedOrder,
    })
    if (openDropdownSecKey === secKey) {
      setOpenDropdownSecKey(null)
    }
    toast.info(t("removeFromSidebar"))
  }

  // --- Section Merge Handlers ---
  const handleStartMergeSections = (sourceSecKey: string, targetSecKey: string) => {
    if (sourceSecKey === targetSecKey) return
    const sourceSec = configuredSections.find((s) => getSectionKey(s) === sourceSecKey)
    const targetSec = configuredSections.find((s) => getSectionKey(s) === targetSecKey)
    if (!sourceSec || !targetSec) return

    const sourceTitle = sourceSec.section?.trim() || "Section"
    const targetTitle = targetSec.section?.trim() || "Section"

    setMergeSectionsModal({
      sourceSecKey,
      targetSecKey,
      sourceTitle,
      targetTitle,
    })
    setMergedSectionName(targetSec.section || sourceSec.section || "")
  }

  const handleConfirmMergeSections = () => {
    if (!mergeSectionsModal) return
    const { sourceSecKey, targetSecKey, sourceTitle } = mergeSectionsModal
    const sourceSec = configuredSections.find((s) => getSectionKey(s) === sourceSecKey)
    const targetSec = configuredSections.find((s) => getSectionKey(s) === targetSecKey)
    if (!sourceSec || !targetSec) {
      setMergeSectionsModal(null)
      return
    }

    const finalTitle = mergedSectionName.trim()

    // 1. Collect all items from Source and Target
    const sourceItems =
      customization.itemOrder?.[sourceSecKey] !== undefined
        ? [...customization.itemOrder[sourceSecKey]]
        : sourceSec.items.map((it) => getItemKey(it))

    const targetItems =
      customization.itemOrder?.[targetSecKey] !== undefined
        ? [...customization.itemOrder[targetSecKey]]
        : targetSec.items.map((it) => getItemKey(it))

    // Combined unique items in order
    const mergedItemKeys = [
      ...targetItems,
      ...sourceItems.filter((k) => !targetItems.includes(k)),
    ]

    const newItemOrder = { ...(customization.itemOrder || {}) }
    const newItemOverrides = { ...(customization.itemOverrides || {}) }
    let updatedGroups = [...(customization.customGroups || [])]
    let updatedSectionOrder = [...(customization.sectionOrder || [])]
    const hiddenSections = customization.hiddenSections || []
    let updatedHiddenSections = [...hiddenSections]

    // 2. Handle Source Section cleanup:
    if (sourceSecKey.startsWith("group-sec:")) {
      const srcGroupId = sourceSecKey.replace("group-sec:", "")
      updatedGroups = updatedGroups.filter((g) => g.id !== srcGroupId)
    } else {
      if (!updatedHiddenSections.includes(sourceSecKey)) {
        updatedHiddenSections.push(sourceSecKey)
      }
    }
    delete newItemOrder[sourceSecKey]
    updatedSectionOrder = updatedSectionOrder.filter((k) => k !== sourceSecKey)

    // 3. Handle Target Section (destination):
    let destinationSecKey = targetSecKey

    if (targetSecKey.startsWith("group-sec:")) {
      const tgtGroupId = targetSecKey.replace("group-sec:", "")
      updatedGroups = updatedGroups.map((g) => {
        if (g.id === tgtGroupId) {
          return {
            ...g,
            label: finalTitle,
            itemKeys: mergedItemKeys,
          }
        }
        return g
      })
    } else {
      // Target was a base section -> convert to custom group
      const newGroupId = `grp_${Date.now()}`
      const newGroup: CustomSidebarGroup = {
        id: newGroupId,
        label: finalTitle || targetSec.section || "Combined Section",
        icon: "folders",
        type: "section",
        itemKeys: mergedItemKeys,
      }
      updatedGroups.push(newGroup)

      if (!updatedHiddenSections.includes(targetSecKey)) {
        updatedHiddenSections.push(targetSecKey)
      }
      delete newItemOrder[targetSecKey]

      destinationSecKey = `group-sec:${newGroupId}`
      if (updatedSectionOrder.includes(targetSecKey)) {
        updatedSectionOrder = updatedSectionOrder.map((k) =>
          k === targetSecKey ? destinationSecKey : k
        )
      } else {
        updatedSectionOrder.push(destinationSecKey)
      }
    }

    newItemOrder[destinationSecKey] = mergedItemKeys
    mergedItemKeys.forEach((k) => {
      newItemOverrides[k] = { sectionKey: destinationSecKey }
    })

    const cleanGroups = updatedGroups.filter(
      (cg) => cg.label.trim() !== "" || cg.itemKeys.length > 0
    )

    onChangeCustomization({
      ...customization,
      customGroups: cleanGroups,
      sectionOrder: updatedSectionOrder,
      hiddenSections: updatedHiddenSections,
      itemOrder: newItemOrder,
      itemOverrides: newItemOverrides,
    })

    setMergeSectionsModal(null)
    toast.success(`Merged "${sourceTitle}" into "${finalTitle || "section"}"`)
  }

  // --- Confirm Merge of 2 Items into Group ---
  const handleConfirmMerge = () => {
    if (!mergeModal) return

    const { sourceItem, targetItem, targetSectionKey } = mergeModal
    const title =
      mergeGroupName.trim() ||
      `${targetItem.label || "Section"}`

    const newItemOrder = { ...(customization.itemOrder || {}) }
    const newItemOverrides = { ...(customization.itemOverrides || {}) }

    // CASE A: User chose Dropdown Section (like Library / Servarr)
    if (mergeGroupType === "section") {
      if (targetSectionKey.startsWith("group-sec:")) {
        const existingGroupId = targetSectionKey.replace("group-sec:", "")
        const updatedGroups = (customization.customGroups || []).map((cg) => {
          if (cg.id === existingGroupId) {
            const filteredKeys = cg.itemKeys.filter(
              (k) => k !== sourceItem.key && k !== targetItem.key
            )
            return {
              ...cg,
              label: title,
              type: "section" as const,
              itemKeys: [targetItem.key, sourceItem.key, ...filteredKeys],
            }
          }
          return {
            ...cg,
            itemKeys: cg.itemKeys.filter((k) => k !== sourceItem.key),
          }
        })

        // Clean up previous section's itemOrder
        Object.keys(newItemOrder).forEach((sKey) => {
          if (sKey !== targetSectionKey) {
            newItemOrder[sKey] = (newItemOrder[sKey] || []).filter(
              (k) => k !== sourceItem.key
            )
          }
        })

        newItemOrder[targetSectionKey] = [
          targetItem.key,
          sourceItem.key,
          ...(newItemOrder[targetSectionKey] || []).filter(
            (k) => k !== sourceItem.key && k !== targetItem.key
          ),
        ]

        newItemOverrides[sourceItem.key] = { sectionKey: targetSectionKey }
        newItemOverrides[targetItem.key] = { sectionKey: targetSectionKey }

        const newHiddenItems = (customization.hiddenItems || []).filter(
          (k) => k !== sourceItem.key && k !== targetItem.key
        )

        const cleanGroups = updatedGroups.filter(
          (cg) => cg.id === existingGroupId || cg.label.trim() !== "" || cg.itemKeys.length > 0
        )
        const activeGroupSecKeys = new Set(cleanGroups.map((g) => `group-sec:${g.id}`))
        const finalSectionOrder = (customization.sectionOrder || []).filter(
          (sKey) => !sKey.startsWith("group-sec:") || activeGroupSecKeys.has(sKey)
        )

        onChangeCustomization({
          ...customization,
          customGroups: cleanGroups,
          sectionOrder: finalSectionOrder,
          itemOrder: newItemOrder,
          itemOverrides: newItemOverrides,
          hiddenItems: newHiddenItems,
        })

        setMergeModal(null)
        toast.success(`Dropdown section "${title}" created`)
        return
      }

      // Otherwise, create a brand new custom dropdown section
      const newGroupId = `grp_${Date.now()}`
      const newGroup: CustomSidebarGroup = {
        id: newGroupId,
        label: title,
        icon: "folders",
        type: "section",
        itemKeys: [targetItem.key, sourceItem.key],
      }

      // Remove merged items from standalone section order so they now live in the group
      Object.keys(newItemOrder).forEach((sKey) => {
        if (newItemOrder[sKey]) {
          newItemOrder[sKey] = newItemOrder[sKey]!.filter(
            (k) => k !== sourceItem.key && k !== targetItem.key
          )
        }
      })

      const cleanGroups = (customization.customGroups || [])
        .map((cg) => ({
          ...cg,
          itemKeys: cg.itemKeys.filter(
            (k) => k !== sourceItem.key && k !== targetItem.key
          ),
        }))
        .filter((cg) => cg.label.trim() !== "" || cg.itemKeys.length > 0)

      const updatedGroups = [...cleanGroups, newGroup]
      const secKey = `group-sec:${newGroupId}`
      let updatedSectionOrder = [...(customization.sectionOrder || [])]
      if (!updatedSectionOrder.includes(secKey)) {
        const targetIdx = updatedSectionOrder.indexOf(targetSectionKey)
        if (targetIdx >= 0) {
          updatedSectionOrder.splice(targetIdx + 1, 0, secKey)
        } else {
          updatedSectionOrder.push(secKey)
        }
      }
      newItemOrder[secKey] = [targetItem.key, sourceItem.key]
      newItemOverrides[sourceItem.key] = { sectionKey: secKey }
      newItemOverrides[targetItem.key] = { sectionKey: secKey }

      const activeGroupSecKeys = new Set(updatedGroups.map((g) => `group-sec:${g.id}`))
      const finalSectionOrder = updatedSectionOrder.filter(
        (sKey) => !sKey.startsWith("group-sec:") || activeGroupSecKeys.has(sKey)
      )

      const newHiddenItems = (customization.hiddenItems || []).filter(
        (k) => k !== sourceItem.key && k !== targetItem.key
      )

      onChangeCustomization({
        ...customization,
        customGroups: updatedGroups,
        sectionOrder: finalSectionOrder,
        itemOrder: newItemOrder,
        itemOverrides: newItemOverrides,
        hiddenItems: newHiddenItems,
      })

      setMergeModal(null)
      toast.success(`Dropdown section "${title}" created`)
      return
    }

    // CASE B: User chose Arrow Menu (like Browse: left side is primary item, right side is arrow holding other items)
    const newGroupId = `grp_${Date.now()}`
    const isTargetExistingFolder = targetItem.key.startsWith("group-folder:")
    const folderGroupId = isTargetExistingFolder
      ? targetItem.key.replace("group-folder:", "")
      : newGroupId

    // If target section is an existing custom section (group-sec:grp_...), keep it as section with label ""
    // so it renders in CASE 2 as a split pill, NOT as a dropdown section!
    let updatedGroups = (customization.customGroups || []).map((cg) => {
      if (cg.id === folderGroupId) {
        const filtered = cg.itemKeys.filter((k) => k !== sourceItem.key)
        return {
          ...cg,
          type: "folder" as const,
          itemKeys: [...filtered, sourceItem.key],
        }
      }
      if (targetSectionKey === `group-sec:${cg.id}` && cg.type === "section") {
        return {
          ...cg,
          label: "", // ensure section title is empty so it renders as a split pill!
        }
      }
      return {
        ...cg,
        itemKeys: cg.itemKeys.filter(
          (k) => k !== sourceItem.key && (!isTargetExistingFolder ? k !== targetItem.key : true)
        ),
      }
    })

    if (!isTargetExistingFolder) {
      const newGroup: CustomSidebarGroup = {
        id: folderGroupId,
        label: targetItem.label,
        icon: "folder",
        type: "folder",
        itemKeys: [targetItem.key, sourceItem.key],
        targetSectionKey: targetSectionKey.startsWith("group-sec:") ? undefined : targetSectionKey,
      }
      updatedGroups = [...updatedGroups, newGroup]
    }

    // Remove sourceItem from standalone item orders
    Object.keys(newItemOrder).forEach((sKey) => {
      if (newItemOrder[sKey]) {
        newItemOrder[sKey] = newItemOrder[sKey]!.filter((k) => k !== sourceItem.key)
      }
    })

    // If target section was an unnamed section or has targetItem, update its order
    if (newItemOrder[targetSectionKey]) {
      newItemOrder[targetSectionKey] = newItemOrder[targetSectionKey]!.map((k) =>
        k === targetItem.key ? `group-folder:${folderGroupId}` : k
      )
    }

    delete newItemOverrides[sourceItem.key]
    delete newItemOverrides[targetItem.key]

    const newHiddenItems = (customization.hiddenItems || []).filter(
      (k) => k !== sourceItem.key && k !== targetItem.key
    )

    const cleanGroups = updatedGroups.filter(
      (cg) => cg.label.trim() !== "" || cg.itemKeys.length > 0
    )

    onChangeCustomization({
      ...customization,
      customGroups: cleanGroups,
      itemOrder: newItemOrder,
      itemOverrides: newItemOverrides,
      hiddenItems: newHiddenItems,
    })

    setMergeModal(null)
    toast.success(`Arrow menu "${targetItem.label}" created`)
  }

  // --- Remove item from Sidebar (Drop on Inventory or click remove) ---
  const handleRemoveItemFromSidebar = (itemKey: string, secKey?: string) => {
    const hidden = customization.hiddenItems || []
    const updatedHidden = hidden.includes(itemKey)
      ? hidden
      : [...hidden, itemKey]

    const newItemOrder = { ...(customization.itemOrder || {}) }
    if (secKey) {
      const sec = configuredSections.find((s) => getSectionKey(s) === secKey)
      const currentItems =
        newItemOrder[secKey] !== undefined
          ? [...newItemOrder[secKey]]
          : sec
            ? sec.items.map((it) => getItemKey(it))
            : []
      newItemOrder[secKey] = currentItems.filter((k) => k !== itemKey)
    }

    const newItemOverrides = { ...(customization.itemOverrides || {}) }
    delete newItemOverrides[itemKey]

    // Also remove from any custom groups
    const folderId = itemKey.startsWith("group-folder:")
      ? itemKey.replace("group-folder:", "")
      : itemKey.startsWith("group-sec:")
        ? itemKey.replace("group-sec:", "")
        : null

    const updatedCustomGroups = (customization.customGroups || [])
      .filter((cg) => !folderId || cg.id !== folderId)
      .map((cg) => ({
        ...cg,
        itemKeys: cg.itemKeys.filter((k) => k !== itemKey),
      }))
      .filter((cg) => cg.label.trim() !== "" || cg.itemKeys.length > 0)

    onChangeCustomization({
      ...customization,
      customGroups: updatedCustomGroups,
      hiddenItems: updatedHidden,
      itemOrder: newItemOrder,
      itemOverrides: newItemOverrides,
    })
  }

  // --- Promote a child item to become the primary item on the split pill ---
  // --- Promote a child item to become the primary item on the split pill ---
  const handlePromoteToPrimary = (
    arrowMenuItemKey: string,
    childKey: string
  ) => {
    let folderId = arrowMenuItemKey.startsWith("group-folder:")
      ? arrowMenuItemKey.replace("group-folder:", "")
      : null

    let isNewGroup = false
    let targetGroup = folderId
      ? (customization.customGroups || []).find((g) => g.id === folderId)
      : null

    let targetSec: SidebarSection | undefined
    if (!targetGroup) {
      // Find the base item in configuredSections to construct a group
      targetSec = configuredSections.find((s) =>
        s.items.some((it) => getItemKey(it) === arrowMenuItemKey)
      )
      const targetItem = targetSec?.items.find(
        (it) => getItemKey(it) === arrowMenuItemKey
      )

      if (targetItem) {
        folderId = `grp_${Date.now()}`
        const initialKeys = [
          arrowMenuItemKey,
          ...(targetItem.children?.map((c) => getItemKey(c)) || []),
        ]
        targetGroup = {
          id: folderId,
          label: targetItem.label,
          icon: "folder",
          type: "folder",
          itemKeys: initialKeys,
          targetSectionKey: targetSec ? getSectionKey(targetSec) : undefined,
        }
        isNewGroup = true
      }
    }

    if (!targetGroup || !folderId) return

    const remaining = targetGroup.itemKeys.filter((k) => k !== childKey)
    const newKeys = [childKey, ...remaining]

    // Find the new primary item's label
    let newLabel = targetGroup.label
    allAppConfigs.forEach((app) => {
      app.config.forEach((sec) => {
        sec.items.forEach((it) => {
          if (getItemKey(it) === childKey) newLabel = it.label
          if (it.children) {
            it.children.forEach((c) => {
              if (getItemKey(c) === childKey) newLabel = c.label
            })
          }
        })
      })
    })

    const updatedGroup: CustomSidebarGroup = {
      ...targetGroup,
      label: newLabel,
      itemKeys: newKeys,
    }

    const cleanExisting = (customization.customGroups || []).filter(
      (g) => g.id !== folderId
    )

    const newItemOrder = { ...(customization.itemOrder || {}) }
    if (isNewGroup && folderId && targetSec) {
      const targetSecKey = getSectionKey(targetSec)
      const currentItemsInSec =
        newItemOrder[targetSecKey] !== undefined
          ? [...newItemOrder[targetSecKey]]
          : targetSec.items.map((it) => getItemKey(it))
      newItemOrder[targetSecKey] = currentItemsInSec.map((k) =>
        k === arrowMenuItemKey ? `group-folder:${folderId}` : k
      )
    }

    onChangeCustomization({
      ...customization,
      customGroups: [...cleanExisting, updatedGroup],
      itemOrder: newItemOrder,
    })

    toast.success(`"${newLabel}" is now the main item`)
  }

  // --- Drop on Arrow Menu (add new item or reorganize children) ---
  const handleDropChildOnArrowMenu = (
    arrowMenuItemKey: string,
    secKey: string,
    sourceItemKey: string,
    targetChildKey?: string,
    position?: "before" | "after" | "inside"
  ) => {
    if (arrowMenuItemKey === sourceItemKey) return
    if (sourceItemKey === targetChildKey) return

    let folderId = arrowMenuItemKey.startsWith("group-folder:")
      ? arrowMenuItemKey.replace("group-folder:", "")
      : null

    let isNewGroup = false
    let targetGroup = folderId
      ? (customization.customGroups || []).find((g) => g.id === folderId)
      : null

    if (!targetGroup) {
      // Find the base item in configuredSections to get its primary key and children
      const targetSec = configuredSections.find((s) => getSectionKey(s) === secKey)
      const targetItem = targetSec?.items.find(
        (it) => getItemKey(it) === arrowMenuItemKey
      )

      if (targetItem) {
        folderId = `grp_${Date.now()}`
        const initialKeys = [
          arrowMenuItemKey,
          ...(targetItem.children?.map((c) => getItemKey(c)) || []),
        ]
        targetGroup = {
          id: folderId,
          label: targetItem.label,
          icon: "folder",
          type: "folder",
          itemKeys: initialKeys,
          targetSectionKey: secKey.startsWith("group-sec:") ? undefined : secKey,
        }
        isNewGroup = true
      }
    }

    if (!targetGroup || !folderId) return

    const primaryKey = targetGroup.itemKeys[0] || arrowMenuItemKey
    let childrenKeys = targetGroup.itemKeys.slice(1)
    const isInternalMove = targetGroup.itemKeys.includes(sourceItemKey)

    if (isInternalMove) {
      if (sourceItemKey === primaryKey) {
        // Source is primary item! Swapping primary with targetChildKey
        if (targetChildKey) {
          const newChildren = childrenKeys.map((k) =>
            k === targetChildKey ? primaryKey : k
          )
          const newGroup: CustomSidebarGroup = {
            ...targetGroup,
            itemKeys: [targetChildKey, ...newChildren],
          }
          const updatedGroups = isNewGroup
            ? [...(customization.customGroups || []), newGroup]
            : (customization.customGroups || []).map((g) =>
                g.id === folderId ? newGroup : g
              )
          onChangeCustomization({
            ...customization,
            customGroups: updatedGroups,
          })
          toast.success("Primary item updated")
          return
        }
      } else {
        // Source is a child: reorder within children
        childrenKeys = childrenKeys.filter((k) => k !== sourceItemKey)
        if (targetChildKey) {
          const targetIdx = childrenKeys.indexOf(targetChildKey)
          if (targetIdx >= 0) {
            const insertIdx = position === "before" ? targetIdx : targetIdx + 1
            childrenKeys.splice(insertIdx, 0, sourceItemKey)
          } else {
            childrenKeys.push(sourceItemKey)
          }
        } else {
          childrenKeys.push(sourceItemKey)
        }
      }
    } else {
      // Adding a new item from outside
      if (targetChildKey) {
        const targetIdx = childrenKeys.indexOf(targetChildKey)
        if (targetIdx >= 0) {
          const insertIdx = position === "before" ? targetIdx : targetIdx + 1
          childrenKeys.splice(insertIdx, 0, sourceItemKey)
        } else {
          childrenKeys.push(sourceItemKey)
        }
      } else {
        childrenKeys.push(sourceItemKey)
      }
    }

    const updatedGroup: CustomSidebarGroup = {
      ...targetGroup,
      itemKeys: [primaryKey, ...childrenKeys],
    }

    const cleanExisting = (customization.customGroups || []).map((cg) => {
      if (cg.id === folderId) return updatedGroup
      return {
        ...cg,
        itemKeys: cg.itemKeys.filter((k) => (isInternalMove ? true : k !== sourceItemKey)),
      }
    })

    const finalGroups = isNewGroup
      ? [...cleanExisting, updatedGroup]
      : cleanExisting

    const newItemOrder = { ...(customization.itemOrder || {}) }
    if (!isInternalMove) {
      Object.keys(newItemOrder).forEach((sKey) => {
        if (newItemOrder[sKey]) {
          newItemOrder[sKey] = newItemOrder[sKey]!.filter((k) => k !== sourceItemKey)
        }
      })
    }

    if (isNewGroup && folderId) {
      const currentItemsInSec =
        newItemOrder[secKey] !== undefined
          ? [...newItemOrder[secKey]]
          : (configuredSections.find((s) => getSectionKey(s) === secKey)?.items.map((it) => getItemKey(it)) || [])
      newItemOrder[secKey] = currentItemsInSec.map((k) =>
        k === arrowMenuItemKey ? `group-folder:${folderId}` : k
      )
    }

    const newItemOverrides = { ...(customization.itemOverrides || {}) }
    delete newItemOverrides[sourceItemKey]

    const newHiddenItems = (customization.hiddenItems || []).filter(
      (k) => k !== sourceItemKey
    )

    onChangeCustomization({
      ...customization,
      customGroups: finalGroups,
      itemOrder: newItemOrder,
      itemOverrides: newItemOverrides,
      hiddenItems: newHiddenItems,
    })

    toast.success(isInternalMove ? "Arrow menu reordered" : "Added to arrow menu")
  }

  // --- Drop on Inventory dropzone (removes item or section from sidebar) ---
  const handleDropOnInventory = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    setDragged(null)

    const raw = e.dataTransfer.getData("application/iris-dnd")
    let payload = dragged
    if (raw) {
      try {
        payload = JSON.parse(raw)
      } catch {}
    }
    if (!payload) return

    if (payload.type === "sidebar-item") {
      handleRemoveItemFromSidebar(payload.key, payload.sourceSectionKey)
      toast.info(t("removeFromSidebar"))
    } else if (payload.type === "section") {
      handleRemoveSection(payload.key)
      toast.info(t("removeFromSidebar"))
    }
  }

  // --- Quick Add from Inventory to Open Dropdown Section or First Section ---
  const handleQuickAddFromInventory = (itemKey: string) => {
    if (itemKey.startsWith("hidden-sec:")) {
      const restoredSecKey = itemKey.replace("hidden-sec:", "")
      const updatedHidden = (customization.hiddenSections || []).filter(
        (k) => k !== restoredSecKey
      )
      const updatedOrder = [...(customization.sectionOrder || [])]
      if (!updatedOrder.includes(restoredSecKey)) {
        updatedOrder.push(restoredSecKey)
      }
      onChangeCustomization({
        ...customization,
        hiddenSections: updatedHidden,
        sectionOrder: updatedOrder,
      })
      toast.success(t("customGroupSaved"))
      return
    }

    const targetSection = openDropdownSecKey
      ? configuredSections.find((s) => getSectionKey(s) === openDropdownSecKey)
      : configuredSections.find((s) => !s.section?.startsWith("#$"))
    if (!targetSection) return
    const secKey = getSectionKey(targetSection)
    handleDropOnSection(
      {
        preventDefault: () => {},
        stopPropagation: () => {},
        dataTransfer: {
          getData: () =>
            JSON.stringify({
              type: "inventory-item",
              key: itemKey,
              label: "",
            }),
        },
      } as any,
      secKey
    )
  }

  // ==============================================================
  // RENDER INVENTORY COMPONENT
  // ==============================================================
  const renderInventoryPanel = (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        if (dropTarget?.type !== "inventory-dropzone") {
          setDropTarget({ type: "inventory-dropzone", key: "inventory" })
        }
      }}
      onDrop={handleDropOnInventory}
      className={cn(
        "flex h-full w-full flex-col gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs transition-all",
        dropTarget?.type === "inventory-dropzone" &&
          "ring-2 ring-destructive/60 border-destructive/60 bg-destructive/5"
      )}
    >
      {/* Header & Search Bar */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconInbox className="size-4 text-primary" />
            <span className="text-xs font-semibold">{t("inventory")}</span>
          </div>
          {dragged && (
            <span className="text-[11px] text-destructive font-medium flex items-center gap-1 animate-pulse select-none">
              <IconTrash className="size-3.5" />
              <span>{t("dropToRemove")}</span>
            </span>
          )}
        </div>

        {/* Search bar */}
        <div className="relative w-full">
          <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            placeholder={t("searchInventory")}
            className="h-8 rounded-xl ps-9 text-xs"
          />
          {inventorySearch && (
            <button
              type="button"
              onClick={() => setInventorySearch("")}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <IconX className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Inventory Items List / Grid */}
      <div
        className={cn(
          "grid gap-2 overflow-y-auto no-scrollbar",
          isHorizontal
            ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-h-[380px]"
            : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 max-h-[500px]"
        )}
      >
        {filteredInventory.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center gap-1.5 py-10 text-center text-xs text-muted-foreground">
            <IconSearch className="size-5 opacity-40" />
            <span>No unassigned items found</span>
          </div>
        ) : (
          filteredInventory.map((item) => {
            return (
              <div
                key={item.key}
                draggable={true}
                onDragStart={(e) =>
                  handleDragStart(e, {
                    type: "inventory-item",
                    key: item.key,
                    label: item.label,
                  })
                }
                onDragEnd={handleDragEnd}
                className={cn(
                  "group/inv relative flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/80 p-2.5 text-start transition-all select-none cursor-grab active:cursor-grabbing hover:border-primary/50 hover:bg-muted/30 hover:shadow-2xs",
                  dragged?.key === item.key && "opacity-30 border-dashed"
                )}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <IconGripVertical className="size-3 text-muted-foreground/40 opacity-0 group-hover/inv:opacity-100 transition-opacity shrink-0" />

                  {item.icon ? (
                    <span className="size-4 shrink-0 text-muted-foreground flex items-center justify-center">
                      {item.icon}
                    </span>
                  ) : item.type === "group" ? (
                    <IconFolders className="size-4 shrink-0 text-primary" />
                  ) : (
                    <IconLink className="size-4 shrink-0 text-primary" />
                  )}

                  <div className="flex flex-col truncate min-w-0">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 truncate">
                      {item.appName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onPress={() => handleQuickAddFromInventory(item.key)}
                    className="size-6 rounded-lg text-primary hover:bg-primary/10 cursor-pointer"
                    aria-label={t("dropToAdd")}
                  >
                    <IconPlus className="size-3" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  // ==============================================================
  // RENDER ACTUAL VERTICAL IRIS SIDEBAR
  // ==============================================================
  const renderActualVerticalSidebar = (
    <SidebarProvider className="min-h-0 w-full" defaultOpen={true}>
      <div className="relative flex h-[620px] w-full flex-col overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm">
        <Sidebar
          collapsible="none"
          className="h-full w-full bg-transparent flex flex-col"
        >
          {/* Real IrisAppMenu in real SidebarHeader */}
          <SidebarHeader className="border-b border-sidebar-border/60 p-2 shrink-0">
            <IrisAppMenu />
          </SidebarHeader>

          {/* Real SidebarContent with interactive drag & drop */}
          <SidebarContent
            onDragOver={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                if (dropTarget?.key !== "sidebar-content-end") {
                  setDropTarget({
                    type: "section-zone",
                    key: "sidebar-content-end",
                  })
                }
              }
            }}
            onDrop={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault()
                e.stopPropagation()
                const raw = e.dataTransfer?.getData("application/iris-dnd")
                let payload: DragPayload | null = dragged
                if (raw) {
                  try {
                    payload = JSON.parse(raw)
                  } catch {}
                }
                handleDropToNewSection(payload)
              }
            }}
            className="no-scrollbar p-2 space-y-2 flex-1 overflow-y-auto"
          >
            {configuredSections.map((section, sIdx) => {
              const secKey = getSectionKey(section)
              if (section.section?.startsWith("#$")) return null

              const isCustomSec = secKey.startsWith("group-sec:")
              const customGroupId = isCustomSec
                ? secKey.replace("group-sec:", "")
                : null
              const customGroup = customGroupId
                ? (customization.customGroups || []).find(
                    (g) => g.id === customGroupId
                  )
                : null

              const isExpanded = expandedSections[secKey] ?? true
              const isSecBefore =
                dropTarget?.type === "section-zone" &&
                dropTarget.key === secKey &&
                dropTarget.position === "before"
              const isSecAfter =
                dropTarget?.type === "section-zone" &&
                dropTarget.key === secKey &&
                dropTarget.position === "after"
              const isSecInside =
                dropTarget?.type === "section-zone" &&
                dropTarget.key === secKey &&
                (!dropTarget.position || dropTarget.position === "inside")

              return (
                <SidebarGroup
                  key={secKey}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = "move"

                    const raw = e.dataTransfer?.getData("application/iris-dnd")
                    let payload: DragPayload | null = dragged
                    if (raw) {
                      try {
                        payload = JSON.parse(raw)
                      } catch {}
                    }
                    if (payload && payload.type === "section" && payload.key === secKey) return

                    const rect = e.currentTarget.getBoundingClientRect()
                    const relY = (e.clientY - rect.top) / rect.height
                    let pos: "before" | "after" | "inside"
                    if (payload?.type === "section") {
                      if (relY < 0.25) pos = "before"
                      else if (relY > 0.75) pos = "after"
                      else pos = "inside"
                    } else {
                      if (relY < 0.2) pos = "before"
                      else if (relY > 0.8) pos = "after"
                      else pos = "inside"
                    }

                    if (
                      dropTarget?.key !== secKey ||
                      dropTarget?.type !== "section-zone" ||
                      dropTarget?.position !== pos
                    ) {
                      setDropTarget({
                        type: "section-zone",
                        key: secKey,
                        position: pos,
                      })
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const pos = dropTarget?.position
                    const raw = e.dataTransfer?.getData("application/iris-dnd")
                    let payload: DragPayload | null = dragged
                    if (raw) {
                      try {
                        payload = JSON.parse(raw)
                      } catch {}
                    }
                    if (payload && payload.type === "section" && payload.key === secKey) return
                    handleDropOnSection(e, secKey, undefined, payload, pos)
                  }}
                  className={cn(
                    "space-y-1 rounded-xl p-1 transition-all duration-150",
                    isSecBefore && "border-t-2 border-t-primary",
                    isSecAfter && "border-b-2 border-b-primary",
                    isSecInside && "ring-2 ring-primary ring-dashed bg-primary/5"
                  )}
                >
                  {section.section && (
                    <SidebarGroupLabel
                      elementType="div"
                      draggable={true}
                      onDragStart={(e) =>
                        handleDragStart(e, {
                          type: "section",
                          key: secKey,
                          label: section.section,
                        })
                      }
                      onDragEnd={handleDragEnd}
                      className="group/section flex w-full cursor-grab items-center justify-between px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase transition-colors select-none hover:text-foreground active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <IconGripVertical className="size-3 text-muted-foreground/60 opacity-0 group-hover/section:opacity-100 transition-opacity shrink-0" />
                        <span className="truncate">{section.section}</span>
                        {isSecInside && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[8px] bg-primary/30 text-primary border border-primary/40 font-bold uppercase animate-pulse"
                          >
                            Merge
                          </Badge>
                        )}
                        {isCustomSec && (
                          <Badge
                            variant="secondary"
                            className="h-3.5 px-1 text-[8px] uppercase tracking-normal"
                          >
                            {t("customBadge")}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {customGroup ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartRenameSection(secKey, section.section || "")}
                              className="cursor-pointer p-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover/section:opacity-100 transition-opacity"
                              title="Rename Section"
                            >
                              <IconPencil className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSection(secKey)}
                              className="cursor-pointer p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover/section:opacity-100 transition-opacity"
                              title={t("removeFromSidebar")}
                            >
                              <IconTrash className="size-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(secKey)}
                            className="cursor-pointer p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover/section:opacity-100 transition-opacity"
                            title={t("removeFromSidebar")}
                            aria-label={t("removeFromSidebar")}
                          >
                            <IconX className="size-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleSection(secKey)}
                          className="cursor-pointer p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <IconChevronDown
                            className={cn(
                              "size-3.5 transition-transform duration-200",
                              !isExpanded && "-rotate-90"
                            )}
                          />
                        </button>
                      </div>
                    </SidebarGroupLabel>
                  )}

                  {isExpanded && (
                    <SidebarMenu
                      className={cn(
                        "gap-1 rounded-2xl border border-border/50 bg-card/50 p-1.5 shadow-xs transition-all min-h-[44px]",
                        section.items.length === 0 &&
                          "border-dashed border-border/80 bg-muted/20 flex items-center justify-center py-3"
                      )}
                    >
                      {section.items.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 italic">
                          <IconInbox className="size-3.5" />
                          <span>{t("dropToAdd")}</span>
                        </div>
                      ) : (
                        section.items.map((item, itemIdx) => {
                          const itemKey = getItemKey(item)
                          const isCustomFolder =
                            itemKey.startsWith("group-folder:")
                          const isCustomLink = itemKey.startsWith("link:")
                          const hasChildren = !!(
                            item.children && item.children.length > 0
                          )
                          const isFolderOpen =
                            openFolderItems[itemKey] ?? false
                          const isItemTarget =
                            dropTarget?.type === "item" &&
                            dropTarget.key === itemKey
                          const isMergeTarget =
                            isItemTarget && dropTarget.position === "inside"
                          const isBeforeTarget =
                            isItemTarget && dropTarget.position === "before"
                          const isAfterTarget =
                            isItemTarget && dropTarget.position === "after"

                          return (
                            <SidebarMenuItem
                              key={itemKey}
                              draggable={true}
                              onDragStart={(e) =>
                                handleDragStart(e, {
                                  type: "sidebar-item",
                                  key: itemKey,
                                  sourceSectionKey: secKey,
                                  label: item.label,
                                })
                              }
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                e.dataTransfer.dropEffect = "move"

                                if (!dragged) return
                                if (dragged.key === itemKey) return

                                const rect = e.currentTarget.getBoundingClientRect()
                                const relY = (e.clientY - rect.top) / rect.height
                                let pos: "before" | "after" | "inside"
                                if (relY < 0.25) pos = "before"
                                else if (relY > 0.75) pos = "after"
                                else pos = "inside"

                                if (
                                  dropTarget?.key !== itemKey ||
                                  dropTarget?.position !== pos
                                ) {
                                  setDropTarget({
                                    type: "item",
                                    key: itemKey,
                                    position: pos,
                                  })
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.stopPropagation()

                                const pos = dropTarget?.position
                                const raw = e.dataTransfer?.getData("application/iris-dnd")
                                let payload: DragPayload | null = dragged
                                if (raw) {
                                  try {
                                    payload = JSON.parse(raw)
                                  } catch {}
                                }

                                if (!payload || (payload.type !== "sidebar-item" && payload.type !== "inventory-item")) return
                                 if (payload.key === itemKey) return

                                if (pos === "inside") {
                                  if (hasChildren) {
                                    handleDropChildOnArrowMenu(itemKey, secKey, payload.key)
                                    setDragged(null)
                                    setDropTarget(null)
                                    return
                                  }
                                  setMergeModal({
                                    sourceItem: {
                                      key: payload.key,
                                      label: payload.label || payload.key,
                                    },
                                    targetItem: {
                                      key: itemKey,
                                      label: item.label,
                                    },
                                    targetSectionKey: secKey,
                                  })
                                  setMergeGroupName("")
                                  setMergeGroupType(section.section ? "section" : "folder")
                                  setDragged(null)
                                  setDropTarget(null)
                                  return
                                }

                                const insertIdx = pos === "after" ? itemIdx + 1 : itemIdx
                                handleDropOnSection(e, secKey, insertIdx, payload, pos, itemKey)
                              }}
                              className={cn(
                                "group/item relative flex flex-col rounded-xl transition-all duration-150 cursor-grab active:cursor-grabbing",
                                isBeforeTarget && "border-t-2 border-t-primary",
                                isAfterTarget && "border-b-2 border-b-primary",
                                isMergeTarget &&
                                  "ring-2 ring-primary bg-primary/20 scale-[1.02] shadow-xs",
                                isItemTarget &&
                                  !isMergeTarget &&
                                  !isBeforeTarget &&
                                  !isAfterTarget &&
                                  "ring-2 ring-primary bg-primary/10",
                                dragged?.key === itemKey &&
                                  "opacity-30 border-dashed"
                              )}
                            >
                              <div className="relative flex w-full items-center">
                                <SidebarMenuButton
                                  className="w-full justify-between gap-2 pe-7 hover:bg-muted/80 cursor-grab active:cursor-grabbing"
                                  onClick={
                                    hasChildren
                                      ? () => toggleFolderItem(itemKey)
                                      : undefined
                                  }
                                >
                                  <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <IconGripVertical className="size-3 text-muted-foreground/40 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0" />
                                    {item.icon ? (
                                      <span className="shrink-0">{item.icon}</span>
                                    ) : isCustomFolder ? (
                                      <IconFolders className="size-4 shrink-0 text-primary" />
                                    ) : isCustomLink ? (
                                      <IconLink className="size-4 shrink-0 text-primary" />
                                    ) : (
                                      <IconFolder className="size-4 shrink-0" />
                                    )}
                                    <span className="truncate">{item.label}</span>
                                  </span>

                                  {isMergeTarget && (
                                    <Badge
                                      variant="secondary"
                                      className="h-4 px-1 text-[8px] bg-primary/30 text-primary border border-primary/40 font-bold uppercase animate-pulse"
                                    >
                                      Merge
                                    </Badge>
                                  )}
                                  {isCustomFolder && !isMergeTarget && (
                                    <Badge
                                      variant="secondary"
                                      className="h-4 px-1.5 text-[9px]"
                                    >
                                      {t("folderBadge")}
                                    </Badge>
                                  )}
                                  {isCustomLink && (
                                    <IconExternalLink className="size-3 text-muted-foreground opacity-70" />
                                  )}
                                </SidebarMenuButton>

                                <div className="absolute end-1.5 flex items-center gap-0.5">
                                  {hasChildren && (
                                    <button
                                      type="button"
                                      onClick={() => toggleFolderItem(itemKey)}
                                      className="cursor-pointer p-0.5 text-muted-foreground hover:text-foreground"
                                    >
                                      <IconChevronDown
                                        className={cn(
                                          "size-3.5 transition-transform duration-200",
                                          isFolderOpen && "rotate-180"
                                        )}
                                      />
                                    </button>
                                  )}

                                  {/* Rename/Name section button on custom item */}
                                  {isCustomSec && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStartRenameSection(
                                          secKey,
                                          section.section || ""
                                        )
                                      }
                                      className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:text-foreground transition-all"
                                      title={section.section ? "Rename Section" : "Name Section"}
                                      aria-label={section.section ? "Rename Section" : "Name Section"}
                                    >
                                      <IconPencil className="size-3.5" />
                                    </button>
                                  )}

                                  {/* Remove from sidebar button on hover */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveItemFromSidebar(
                                        itemKey,
                                        secKey
                                      )
                                    }
                                    className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                    title={t("removeFromSidebar")}
                                    aria-label={t("removeFromSidebar")}
                                  >
                                    <IconX className="size-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Folder Children if open */}
                              {hasChildren && isFolderOpen && (
                                <SidebarMenuSub className="ms-3.5 me-0 mt-1 border-s border-sidebar-border/60 ps-2 pe-0">
                                  {item.children!.map((child, cIdx) => {
                                    const childKey = getItemKey(child)
                                    const isChildTarget = dropTarget?.type === "item" && dropTarget.key === childKey
                                    const isBefore = isChildTarget && dropTarget.position === "before"
                                    const isAfter = isChildTarget && dropTarget.position === "after"

                                    return (
                                      <SidebarMenuSubItem
                                        key={cIdx}
                                        draggable={true}
                                        onDragStart={(e) => {
                                          e.stopPropagation()
                                          handleDragStart(e, {
                                            type: "sidebar-item",
                                            key: childKey,
                                            sourceSectionKey: secKey,
                                            label: child.label,
                                          })
                                        }}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          e.dataTransfer.dropEffect = "move"
                                          if (dragged && dragged.key === childKey) return

                                          const rect = e.currentTarget.getBoundingClientRect()
                                          const relY = (e.clientY - rect.top) / rect.height
                                          const pos = relY < 0.5 ? "before" : "after"
                                          if (dropTarget?.key !== childKey || dropTarget?.position !== pos) {
                                            setDropTarget({ type: "item", key: childKey, position: pos })
                                          }
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          const raw = e.dataTransfer?.getData("application/iris-dnd")
                                          let payload: DragPayload | null = dragged
                                          if (raw) {
                                            try {
                                              payload = JSON.parse(raw)
                                            } catch {}
                                          }
                                          if (!payload || payload.key === childKey) return
                                          handleDropChildOnArrowMenu(
                                            itemKey,
                                            secKey,
                                            payload.key,
                                            childKey,
                                            dropTarget?.position
                                          )
                                        }}
                                        className={cn(
                                          "group/subitem relative flex items-center justify-between rounded-lg transition-all",
                                          isBefore && "border-t-2 border-t-primary",
                                          isAfter && "border-b-2 border-b-primary",
                                          dragged?.key === childKey && "opacity-30 border border-dashed border-primary"
                                        )}
                                      >
                                        <SidebarMenuSubButton className="w-full justify-between gap-2 text-xs">
                                          <span className="flex min-w-0 flex-1 items-center gap-2">
                                            <IconGripVertical className="size-3 text-muted-foreground/40 opacity-0 group-hover/subitem:opacity-100 transition-opacity shrink-0" />
                                            {child.icon && (
                                              <span className="size-3.5 shrink-0">
                                                {child.icon}
                                              </span>
                                            )}
                                            <span className="truncate">
                                              {child.label}
                                            </span>
                                          </span>
                                        </SidebarMenuSubButton>

                                        <div className="absolute end-1 flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handlePromoteToPrimary(itemKey, childKey)
                                            }}
                                            className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/subitem:opacity-100 hover:text-primary transition-all"
                                            title="Make primary item"
                                            aria-label="Make primary item"
                                          >
                                            <IconArrowsExchange className="size-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleRemoveItemFromSidebar(childKey, secKey)
                                            }}
                                            className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/subitem:opacity-100 hover:text-destructive transition-all"
                                            title={t("removeFromSidebar")}
                                            aria-label={t("removeFromSidebar")}
                                          >
                                            <IconX className="size-3" />
                                          </button>
                                        </div>
                                      </SidebarMenuSubItem>
                                    )
                                  })}

                                  {/* Dropzone at bottom of sub-menu */}
                                  <div
                                    onDragOver={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      e.dataTransfer.dropEffect = "move"
                                      if (dropTarget?.key !== `${itemKey}-sub-end`) {
                                        setDropTarget({ type: "item", key: `${itemKey}-sub-end` })
                                      }
                                    }}
                                    onDrop={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const raw = e.dataTransfer?.getData("application/iris-dnd")
                                      let payload: DragPayload | null = dragged
                                      if (raw) {
                                        try {
                                          payload = JSON.parse(raw)
                                        } catch {}
                                      }
                                      if (!payload) return
                                      handleDropChildOnArrowMenu(itemKey, secKey, payload.key)
                                    }}
                                    className={cn(
                                      "flex items-center justify-center gap-1 rounded-xl border border-dashed py-1 text-[11px] transition-all select-none cursor-default my-0.5",
                                      dropTarget?.key === `${itemKey}-sub-end`
                                        ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary"
                                        : "border-border/40 text-muted-foreground/50 hover:border-border hover:text-muted-foreground"
                                    )}
                                  >
                                    <IconPlus className="size-3" />
                                    <span>{t("dropToAdd")}</span>
                                  </div>
                                </SidebarMenuSub>
                              )}
                            </SidebarMenuItem>
                          )
                        })
                      )}
                    </SidebarMenu>
                  )}
                </SidebarGroup>
              )
            })}

          </SidebarContent>

          {/* Real SidebarFooter with IrisUserMenu */}
          <SidebarFooter className="border-t border-sidebar-border/60 p-2 shrink-0">
            <IrisUserMenu />
          </SidebarFooter>
        </Sidebar>
      </div>
    </SidebarProvider>
  )

  // ==============================================================
  // RENDER ACTUAL HORIZONTAL IRIS HEADER / NAVBAR
  // ==============================================================
  const renderActualHorizontalNavbar = (
    <div className="flex flex-col gap-2.5 w-full">
      <header
        onDragOver={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            if (dropTarget?.key !== "navbar-end") {
              setDropTarget({ type: "section-zone", key: "navbar-end" })
            }
          }
        }}
        onDrop={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            e.stopPropagation()
            const raw = e.dataTransfer?.getData("application/iris-dnd")
            let payload: DragPayload | null = dragged
            if (raw) {
              try {
                payload = JSON.parse(raw)
              } catch {}
            }
            handleDropToNewSection(payload)
          }
        }}
        className="flex h-14 w-full items-center justify-center rounded-2xl border border-border/80 bg-background/95 px-4 shadow-xs backdrop-blur-md transition-all"
      >
        {/* Center: Horizontally Scrollable Segmented Navigation with interactive sections */}
        <nav
          ref={editorNavRef}
          onScroll={updateNavScroll}
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              e.currentTarget.scrollLeft += e.deltaY
            }
          }}
          onDragOver={(e) => {
            // Auto-scroll near horizontal edges when dragging an item
            if (editorNavRef.current) {
              const rect = editorNavRef.current.getBoundingClientRect()
              const edgeThreshold = 45
              if (e.clientX < rect.left + edgeThreshold) {
                editorNavRef.current.scrollLeft -= 8
              } else if (e.clientX > rect.right - edgeThreshold) {
                editorNavRef.current.scrollLeft += 8
              }
            }
            if (e.target === e.currentTarget) {
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
              if (dropTarget?.key !== "navbar-end") {
                setDropTarget({ type: "section-zone", key: "navbar-end" })
              }
            }
          }}
          onDrop={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault()
              e.stopPropagation()
              const raw = e.dataTransfer?.getData("application/iris-dnd")
              let payload: DragPayload | null = dragged
              if (raw) {
                try {
                  payload = JSON.parse(raw)
                } catch {}
              }
              handleDropToNewSection(payload)
            }
          }}
          className="flex min-w-0 flex-1 items-center justify-start overflow-x-auto no-scrollbar scrollbar-none px-2 py-1 mx-2 scroll-smooth"
        >
          <div
            onDragOver={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                if (dropTarget?.key !== "navbar-end") {
                  setDropTarget({ type: "section-zone", key: "navbar-end" })
                }
              }
            }}
            onDrop={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault()
                e.stopPropagation()
                const raw = e.dataTransfer?.getData("application/iris-dnd")
                let payload: DragPayload | null = dragged
                if (raw) {
                  try {
                    payload = JSON.parse(raw)
                  } catch {}
                }
                handleDropToNewSection(payload)
              }
            }}
            className="flex items-center gap-1 rounded-2xl border border-border/60 bg-muted/30 p-1 shadow-2xs backdrop-blur-md shrink-0 mx-auto"
          >
          {configuredSections.map((section: SidebarSection) => {
            const secKey = getSectionKey(section)
            if (section.section?.startsWith("#$")) return null

            const isCustomSec = secKey.startsWith("group-sec:")
            const visibleItems = section.items.filter(
              (item: SidebarItem) => (item.position ?? 0) >= 0
            )

            const hasSectionTitle = Boolean(
              section.section && section.section.trim() !== ""
            )

            const isSecBeforeTarget =
              dropTarget?.type === "section-zone" &&
              dropTarget.key === secKey &&
              dropTarget.position === "before"
            const isSecAfterTarget =
              dropTarget?.type === "section-zone" &&
              dropTarget.key === secKey &&
              dropTarget.position === "after"
            const isSecInsideTarget =
              dropTarget?.type === "section-zone" &&
              dropTarget.key === secKey &&
              (!dropTarget.position || dropTarget.position === "inside")

            // CASE 1: Dropdown by section (if label not empty, e.g. Library, Servarr)
            if (hasSectionTitle) {
              const isSectionActive = visibleItems.some((item) => {
                if (item.isActive) return true
                if (isRouteActive(pathname, item.href)) return true
                if (item.children?.some((c) => isRouteActive(pathname, c.href)))
                  return true
                return false
              })

              return (
                <div
                  key={secKey}
                  draggable={true}
                  onDragStart={(e) => {
                    handleDragStart(e, {
                      type: "section",
                      key: secKey,
                      label: section.section!,
                    })
                  }}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = "move"

                    const raw = e.dataTransfer?.getData("application/iris-dnd")
                    let payload: DragPayload | null = dragged
                    if (raw) {
                      try {
                        payload = JSON.parse(raw)
                      } catch {}
                    }
                    if (payload && payload.type === "section" && payload.key === secKey) return

                    const rect = e.currentTarget.getBoundingClientRect()
                    const relX = (e.clientX - rect.left) / rect.width
                    let pos: "before" | "after" | "inside"
                    if (payload?.type === "section") {
                      if (relX < 0.25) pos = "before"
                      else if (relX > 0.75) pos = "after"
                      else pos = "inside"
                    } else {
                      if (relX < 0.25) pos = "before"
                      else if (relX > 0.75) pos = "after"
                      else pos = "inside"
                    }

                    if (
                      dropTarget?.key !== secKey ||
                      dropTarget?.type !== "section-zone" ||
                      dropTarget?.position !== pos
                    ) {
                      setDropTarget({
                        type: "section-zone",
                        key: secKey,
                        position: pos,
                      })
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const pos = dropTarget?.position
                    const raw = e.dataTransfer?.getData("application/iris-dnd")
                    let payload: DragPayload | null = dragged
                    if (raw) {
                      try {
                        payload = JSON.parse(raw)
                      } catch {}
                    }
                    if (payload && payload.type === "section" && payload.key === secKey) return
                    handleDropOnSection(e, secKey, undefined, payload, pos)
                  }}
                  className={cn(
                    "group/sec flex items-center rounded-xl transition-all duration-200 border cursor-grab active:cursor-grabbing",
                    isSectionActive
                      ? "border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border-transparent",
                    openDropdownSecKey === secKey && "bg-muted/80 text-foreground",
                    isSecBeforeTarget && "border-s-2 border-s-primary",
                    isSecAfterTarget && "border-e-2 border-e-primary",
                    isSecInsideTarget && "ring-2 ring-primary ring-dashed bg-primary/10",
                    dragged?.type === "section" && dragged.key === secKey && "opacity-30 border border-dashed border-primary"
                  )}
                >
                  {/* Grip Handle for Section Dragging */}
                  <div
                    className="flex items-center ps-2 pe-0.5 py-1.5 text-muted-foreground/40 hover:text-foreground select-none pointer-events-none"
                    title="Drag to reorder section"
                  >
                    <IconGripVertical className="size-3" />
                  </div>

                  <PopoverTrigger
                    isOpen={openDropdownSecKey === secKey}
                    onOpenChange={(isOpen) => {
                      if (!isOpen && dragged) return
                      setOpenDropdownSecKey(isOpen ? secKey : null)
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onPointerDown={(e) => e.stopPropagation()}
                      className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-none px-1.5 py-1.5 text-xs font-semibold whitespace-nowrap bg-transparent hover:bg-transparent shadow-none border-none text-inherit h-auto"
                    >
                      <span>{section.section}</span>
                      {isSecInsideTarget && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[8px] bg-primary/30 text-primary border border-primary/40 font-bold uppercase animate-pulse ms-1"
                        >
                          Merge
                        </Badge>
                      )}
                      <IconChevronDown
                        className={cn(
                          "size-3.5 opacity-60 transition-transform duration-200",
                          openDropdownSecKey === secKey && "rotate-180"
                        )}
                      />
                    </Button>

                    <Popover
                      placement="bottom start"
                      offset={8}
                      isNonModal={true}
                      className="z-50 min-w-56 w-auto origin-(--trigger-anchor-point) flex flex-col gap-1 rounded-2xl border border-border/70 bg-popover/90 p-2 text-popover-foreground shadow-xl backdrop-blur-2xl backdrop-saturate-150 outline-hidden"
                    >
                      <div
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          e.dataTransfer.dropEffect = "move"
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDropOnSection(e, secKey)
                        }}
                        className="flex flex-col gap-1 w-full"
                      >
                        <div className="flex items-center justify-between px-2 py-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase select-none truncate">
                              {section.section}
                            </span>
                            {isCustomSec && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleStartRenameSection(secKey, section.section || "")
                                }}
                                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                title="Rename Section"
                                aria-label="Rename Section"
                              >
                                <IconPencil className="size-3" />
                              </button>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[9px] shrink-0">
                            {visibleItems.length} items
                          </Badge>
                        </div>
                        <div className="h-px w-full bg-border/60 my-0.5" />

                        {visibleItems.length === 0 ? (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              e.dataTransfer.dropEffect = "move"
                              if (dropTarget?.key !== `${secKey}-empty`) {
                                setDropTarget({ type: "item", key: `${secKey}-empty` })
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDropOnSection(e, secKey, 0)
                            }}
                            className={cn(
                              "flex flex-col items-center justify-center gap-1.5 px-3 py-6 text-center text-xs rounded-xl border border-dashed transition-all",
                              dropTarget?.key === `${secKey}-empty`
                                ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary"
                                : "border-border/60 text-muted-foreground/60 italic"
                            )}
                          >
                            <IconInbox className="size-4 opacity-60" />
                            <span>{t("dropToAdd")}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto no-scrollbar">
                            {visibleItems.map((item, itemIdx) => {
                              const itemKey = getItemKey(item)
                              const hasChildren = Boolean(
                                item.children && item.children.length > 0
                              )
                              const isItemActive = isRouteActive(pathname, item.href)
                              const isItemTarget =
                                dropTarget?.type === "item" && dropTarget.key === itemKey
                              const isMergeTarget = isItemTarget && dropTarget.position === "inside"
                              const isBeforeTarget = isItemTarget && dropTarget.position === "before"
                              const isAfterTarget = isItemTarget && dropTarget.position === "after"

                              return (
                                <div
                                  key={itemKey}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    e.stopPropagation()
                                    handleDragStart(e, {
                                      type: "sidebar-item",
                                      key: itemKey,
                                      sourceSectionKey: secKey,
                                      label: item.label,
                                    })
                                  }}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    e.dataTransfer.dropEffect = "move"

                                    if (!dragged) return
                                    if (dragged.key === itemKey) return

                                    const rect = e.currentTarget.getBoundingClientRect()
                                    const relY = (e.clientY - rect.top) / rect.height
                                    let pos: "before" | "after" | "inside"
                                    if (relY < 0.25) pos = "before"
                                    else if (relY > 0.75) pos = "after"
                                    else pos = "inside"

                                    if (dropTarget?.key !== itemKey || dropTarget?.position !== pos) {
                                      setDropTarget({ type: "item", key: itemKey, position: pos })
                                    }
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()

                                    const pos = dropTarget?.position
                                    const raw = e.dataTransfer?.getData("application/iris-dnd")
                                    let payload: DragPayload | null = dragged
                                    if (raw) {
                                      try {
                                        payload = JSON.parse(raw)
                                      } catch {}
                                    }

                                    if (!payload || (payload.type !== "sidebar-item" && payload.type !== "inventory-item")) return
                                     if (payload.key === itemKey) return

                                    if (pos === "inside") {
                                      if (hasChildren) {
                                        handleDropChildOnArrowMenu(itemKey, secKey, payload.key)
                                        setDragged(null)
                                        setDropTarget(null)
                                        return
                                      }
                                      setMergeModal({
                                        sourceItem: {
                                          key: payload.key,
                                          label: payload.label || payload.key,
                                        },
                                        targetItem: {
                                          key: itemKey,
                                          label: item.label,
                                        },
                                        targetSectionKey: secKey,
                                      })
                                      setMergeGroupName("")
                                      setMergeGroupType("section")
                                      setDragged(null)
                                      setDropTarget(null)
                                      return
                                    }

                                    const insertIdx = pos === "after" ? itemIdx + 1 : itemIdx
                                    handleDropOnSection(e, secKey, insertIdx, payload, pos, itemKey)
                                  }}
                                  className={cn(
                                    "group/ditem flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs hover:bg-muted/60 transition-all select-none cursor-grab active:cursor-grabbing",
                                    isBeforeTarget && "border-t-2 border-t-primary",
                                    isAfterTarget && "border-b-2 border-b-primary",
                                    isMergeTarget && "ring-2 ring-primary bg-primary/20 scale-[1.02] shadow-xs",
                                    isItemTarget && !isMergeTarget && !isBeforeTarget && !isAfterTarget && "ring-2 ring-primary bg-primary/15",
                                    dragged?.key === itemKey && "opacity-30 border border-dashed border-primary"
                                  )}
                                >
                                  <div className="flex items-center gap-2 truncate min-w-0">
                                    <IconGripVertical className="size-3 text-muted-foreground/40 opacity-0 group-hover/ditem:opacity-100 transition-opacity shrink-0" />
                                    {item.icon && (
                                      <span className="size-3.5 shrink-0 text-muted-foreground">
                                        {item.icon}
                                      </span>
                                    )}
                                    <span
                                      className={cn(
                                        "truncate font-medium",
                                        isItemActive && "text-primary font-bold"
                                      )}
                                    >
                                      {item.label}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {isMergeTarget && (
                                      <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-primary/30 text-primary border border-primary/40 font-bold uppercase animate-pulse">
                                        Merge
                                      </Badge>
                                    )}
                                    {item.badge && !isMergeTarget && (
                                      <Badge
                                        variant="secondary"
                                        className="h-4 px-1.5 text-[9px]"
                                      >
                                        {item.badge}
                                      </Badge>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemoveItemFromSidebar(itemKey, secKey)
                                      }}
                                      className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/ditem:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                      title={t("removeFromSidebar")}
                                      aria-label={t("removeFromSidebar")}
                                    >
                                      <IconX className="size-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}

                            {/* Dropzone at bottom of dropdown list to append */}
                            <div
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                e.dataTransfer.dropEffect = "move"
                                if (dropTarget?.key !== `${secKey}-bottom`) {
                                  setDropTarget({ type: "item", key: `${secKey}-bottom` })
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const raw = e.dataTransfer?.getData("application/iris-dnd")
                                let payload: DragPayload | null = dragged
                                if (raw) {
                                  try {
                                    payload = JSON.parse(raw)
                                  } catch {}
                                }
                                handleDropOnSection(e, secKey, visibleItems.length, payload)
                              }}
                              className={cn(
                                "flex items-center justify-center gap-1 rounded-xl border border-dashed py-1.5 mt-1 text-[11px] transition-all select-none cursor-default",
                                dropTarget?.key === `${secKey}-bottom`
                                  ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary"
                                  : "border-border/40 text-muted-foreground/50 hover:border-border hover:text-muted-foreground"
                              )}
                            >
                              <IconPlus className="size-3" />
                              <span>{t("dropToAdd")}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Popover>
                  </PopoverTrigger>

                  {/* Rename section button */}
                  {isCustomSec && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartRenameSection(secKey, section.section || "")
                      }}
                      className="cursor-pointer rounded p-1 text-muted-foreground/40 opacity-0 group-hover/sec:opacity-100 hover:text-foreground transition-all"
                      title="Rename Section"
                      aria-label="Rename Section"
                    >
                      <IconPencil className="size-3" />
                    </button>
                  )}

                  {/* Remove section button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveSection(secKey)
                    }}
                    className="cursor-pointer rounded p-1 pe-2 text-muted-foreground/40 opacity-0 group-hover/sec:opacity-100 hover:text-destructive transition-all"
                    title={t("removeFromSidebar")}
                    aria-label={t("removeFromSidebar")}
                  >
                    <IconX className="size-3" />
                  </button>
                </div>
              )
            }

            // CASE 2: Section label is empty -> Render items directly as pills in the segmented bar (e.g. Home, Browse, Calendar)
            return visibleItems.map((item, itemIdx) => {
              const itemKey = getItemKey(item)
              const hasChildren = Boolean(
                item.children && item.children.length > 0
              )
              const isChildActive =
                hasChildren &&
                item.children!.some((c) => isRouteActive(pathname, c.href))
              const isDirectActive =
                item.isActive !== undefined
                  ? item.isActive
                  : isRouteActive(pathname, item.href)
              const isActive = isDirectActive || isChildActive
              const isItemTarget =
                dropTarget?.type === "item" && dropTarget.key === itemKey
              const isMergeTarget = isItemTarget && dropTarget.position === "inside"
              const isBeforeTarget = isItemTarget && dropTarget.position === "before"
              const isAfterTarget = isItemTarget && dropTarget.position === "after"

              const handlePillDragOver = (e: React.DragEvent) => {
                e.preventDefault()
                e.stopPropagation()
                e.dataTransfer.dropEffect = "move"

                if (dragged && dragged.key === itemKey) return

                const rect = e.currentTarget.getBoundingClientRect()
                const relX = (e.clientX - rect.left) / rect.width
                let pos: "before" | "after" | "inside"
                if (dragged?.type === "section") {
                  if (relX < 0.25) pos = "before"
                  else if (relX > 0.75) pos = "after"
                  else pos = "inside"
                } else {
                  if (relX < 0.25) pos = "before"
                  else if (relX > 0.75) pos = "after"
                  else pos = "inside"
                }

                if (dropTarget?.key !== itemKey || dropTarget?.position !== pos) {
                  setDropTarget({ type: "item", key: itemKey, position: pos })
                }
              }

              const handlePillDrop = (e: React.DragEvent) => {
                e.preventDefault()
                e.stopPropagation()

                const pos = dropTarget?.position
                const raw = e.dataTransfer?.getData("application/iris-dnd")
                let payload: DragPayload | null = dragged
                if (raw) {
                  try {
                    payload = JSON.parse(raw)
                  } catch {}
                }

                if (!payload) return
                if (payload.key === itemKey) return

                if (payload.type === "section") {
                  if (payload.key === secKey) return
                  handleDropOnSection(e, secKey, undefined, payload, pos)
                  return
                }

                if (payload.type !== "sidebar-item" && payload.type !== "inventory-item") return

                if (pos === "inside") {
                  if (hasChildren) {
                    handleDropChildOnArrowMenu(itemKey, secKey, payload.key)
                    setDragged(null)
                    setDropTarget(null)
                    return
                  }
                  setMergeModal({
                    sourceItem: {
                      key: payload.key,
                      label: payload.label || payload.key,
                    },
                    targetItem: {
                      key: itemKey,
                      label: item.label,
                    },
                    targetSectionKey: secKey,
                  })
                  setMergeGroupName("")
                  setMergeGroupType("folder")
                  setDragged(null)
                  setDropTarget(null)
                  return
                }

                const insertIdx = pos === "after" ? itemIdx + 1 : itemIdx
                handleDropOnSection(e, secKey, insertIdx, payload, pos, itemKey)
              }

              if (hasChildren) {
                return (
                  <div
                    key={itemKey}
                    draggable={true}
                    onDragStart={(e) =>
                      handleDragStart(e, {
                        type: "sidebar-item",
                        key: itemKey,
                        sourceSectionKey: secKey,
                        label: item.label,
                      })
                    }
                    onDragEnd={handleDragEnd}
                    onDragOver={handlePillDragOver}
                    onDrop={handlePillDrop}
                    className={cn(
                      "group flex shrink-0 items-center rounded-xl transition-all duration-200 border cursor-grab active:cursor-grabbing",
                      isActive
                        ? "border-primary/40 bg-primary/15 text-primary shadow-xs ring-1 ring-primary/20"
                        : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      isBeforeTarget && "border-s-2 border-s-primary",
                      isAfterTarget && "border-e-2 border-e-primary",
                      isMergeTarget && "ring-2 ring-primary bg-primary/25 scale-[1.03] shadow-xs",
                      isItemTarget && !isMergeTarget && !isBeforeTarget && !isAfterTarget && "ring-2 ring-primary bg-primary/20",
                      dragged?.key === itemKey && "opacity-30 border border-dashed border-primary"
                    )}
                  >
                    <div className="flex cursor-pointer items-center gap-1.5 rounded-s-xl px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors">
                      {item.icon && (
                        <span className="size-3.5 shrink-0">{item.icon}</span>
                      )}
                      <span>{item.label}</span>
                      {isMergeTarget && (
                        <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-primary/30 text-primary border border-primary/40 font-bold uppercase animate-pulse">
                          {hasChildren ? "Add" : "Merge"}
                        </Badge>
                      )}
                    </div>

                    <span
                      className={cn(
                        "h-3.5 w-px shrink-0 transition-colors",
                        isActive ? "bg-primary/30" : "bg-border/60"
                      )}
                    />

                    <PopoverTrigger>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "flex h-7 w-6 cursor-pointer items-center justify-center rounded-none p-0 transition-colors",
                          isActive
                            ? "hover:bg-primary/20 text-primary"
                            : "hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                        )}
                        aria-label={`${item.label} options`}
                      >
                        <IconChevronDown className="size-3.5 opacity-70" />
                      </Button>
                      <Popover
                        placement="bottom start"
                        offset={8}
                        isNonModal={true}
                        className="z-50 min-w-48 w-auto origin-(--trigger-anchor-point) flex flex-col gap-0.5 rounded-2xl border border-border/70 bg-popover/95 p-1.5 text-popover-foreground shadow-xl backdrop-blur-2xl backdrop-saturate-150 outline-hidden"
                      >
                        {item.children!.map((child, cIdx) => {
                          const childKey = getItemKey(child)
                          const isSubActive = isRouteActive(pathname, child.href)
                          const isChildTarget = dropTarget?.type === "item" && dropTarget.key === childKey
                          const isBefore = isChildTarget && dropTarget.position === "before"
                          const isAfter = isChildTarget && dropTarget.position === "after"

                          return (
                            <div
                              key={childKey || cIdx}
                              draggable={true}
                              onDragStart={(e) => {
                                e.stopPropagation()
                                handleDragStart(e, {
                                  type: "sidebar-item",
                                  key: childKey,
                                  sourceSectionKey: secKey,
                                  label: child.label,
                                })
                              }}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                e.dataTransfer.dropEffect = "move"
                                if (dragged && dragged.key === childKey) return

                                const rect = e.currentTarget.getBoundingClientRect()
                                const relY = (e.clientY - rect.top) / rect.height
                                const pos = relY < 0.5 ? "before" : "after"
                                if (dropTarget?.key !== childKey || dropTarget?.position !== pos) {
                                  setDropTarget({ type: "item", key: childKey, position: pos })
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const raw = e.dataTransfer?.getData("application/iris-dnd")
                                let payload: DragPayload | null = dragged
                                if (raw) {
                                  try {
                                    payload = JSON.parse(raw)
                                  } catch {}
                                }
                                if (!payload || payload.key === childKey) return
                                handleDropChildOnArrowMenu(
                                  itemKey,
                                  secKey,
                                  payload.key,
                                  childKey,
                                  dropTarget?.position
                                )
                                setDragged(null)
                                setDropTarget(null)
                              }}
                              className={cn(
                                "group/citem relative flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs select-none hover:bg-muted/60 transition-all cursor-grab active:cursor-grabbing",
                                isBefore && "border-t-2 border-t-primary",
                                isAfter && "border-b-2 border-b-primary",
                                isSubActive && "bg-primary/10 font-bold text-primary",
                                dragged?.key === childKey && "opacity-30 border border-dashed border-primary"
                              )}
                            >
                              <span className="flex items-center gap-2 min-w-0 flex-1">
                                <IconGripVertical className="size-3 text-muted-foreground/40 opacity-0 group-hover/citem:opacity-100 transition-opacity shrink-0" />
                                {child.icon && (
                                  <span className="size-3.5 shrink-0">
                                    {child.icon}
                                  </span>
                                )}
                                <span className="truncate">{child.label}</span>
                              </span>
                              <div className="flex items-center gap-0.5 shrink-0 ms-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handlePromoteToPrimary(itemKey, childKey)
                                  }}
                                  className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/citem:opacity-100 hover:text-primary transition-all"
                                  title="Make main item"
                                  aria-label="Make main item"
                                >
                                  <IconArrowsExchange className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveItemFromSidebar(childKey, secKey)
                                  }}
                                  className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/citem:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                                  title={t("removeFromSidebar")}
                                  aria-label={t("removeFromSidebar")}
                                >
                                  <IconX className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}

                        {/* Dropzone at bottom of arrow menu popover to append items */}
                        <div
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            e.dataTransfer.dropEffect = "move"
                            if (dropTarget?.key !== `${itemKey}-popover-end`) {
                              setDropTarget({ type: "item", key: `${itemKey}-popover-end` })
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const raw = e.dataTransfer?.getData("application/iris-dnd")
                            let payload: DragPayload | null = dragged
                            if (raw) {
                              try {
                                payload = JSON.parse(raw)
                              } catch {}
                            }
                            if (!payload) return
                            handleDropChildOnArrowMenu(itemKey, secKey, payload.key)
                            setDragged(null)
                            setDropTarget(null)
                          }}
                          className={cn(
                            "flex items-center justify-center gap-1 rounded-xl border border-dashed py-1 text-[11px] transition-all select-none cursor-default my-0.5",
                            dropTarget?.key === `${itemKey}-popover-end`
                              ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary"
                              : "border-border/40 text-muted-foreground/50 hover:border-border hover:text-muted-foreground"
                          )}
                        >
                          <IconPlus className="size-3" />
                          <span>{t("dropToAdd")}</span>
                        </div>
                      </Popover>
                    </PopoverTrigger>

                    {isCustomSec && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartRenameSection(secKey, section.section || "")
                        }}
                        className="cursor-pointer rounded p-1 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-foreground transition-all"
                        title={section.section ? "Rename Section" : "Name Section"}
                        aria-label={section.section ? "Rename Section" : "Name Section"}
                      >
                        <IconPencil className="size-3" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveItemFromSidebar(itemKey, secKey)
                      }}
                      className="cursor-pointer rounded p-1 pe-1.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      title={t("removeFromSidebar")}
                      aria-label={t("removeFromSidebar")}
                    >
                      <IconX className="size-3" />
                    </button>
                  </div>
                )
              }

              // Simple direct pill (like Home, Calendar)
              return (
                <div
                  key={itemKey}
                  draggable={true}
                  onDragStart={(e) =>
                    handleDragStart(e, {
                      type: "sidebar-item",
                      key: itemKey,
                      sourceSectionKey: secKey,
                      label: item.label,
                    })
                  }
                  onDragEnd={handleDragEnd}
                  onDragOver={handlePillDragOver}
                  onDrop={handlePillDrop}
                  className={cn(
                    "group flex shrink-0 cursor-grab items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 select-none active:cursor-grabbing",
                    isActive
                      ? "border border-primary/40 bg-primary/15 font-bold text-primary shadow-xs ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent",
                    isBeforeTarget && "border-s-2 border-s-primary",
                    isAfterTarget && "border-e-2 border-e-primary",
                    isMergeTarget && "ring-2 ring-primary bg-primary/25 scale-[1.03] shadow-xs",
                    isItemTarget && !isMergeTarget && !isBeforeTarget && !isAfterTarget && "ring-2 ring-primary bg-primary/20",
                    dragged?.key === itemKey && "opacity-30 border border-dashed border-primary"
                  )}
                >
                  {item.icon && (
                    <span className="size-3.5 shrink-0">{item.icon}</span>
                  )}
                  <span>{item.label}</span>
                  {isMergeTarget && (
                    <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-primary/30 text-primary border border-primary/40 font-bold uppercase animate-pulse">
                      Merge
                    </Badge>
                  )}
                  {isCustomSec && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartRenameSection(secKey, section.section || "")
                      }}
                      className="cursor-pointer rounded p-0.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-foreground transition-all ms-0.5"
                      title={section.section ? "Rename Section" : "Name Section"}
                      aria-label={section.section ? "Rename Section" : "Name Section"}
                    >
                      <IconPencil className="size-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveItemFromSidebar(itemKey, secKey)
                    }}
                    className="cursor-pointer rounded p-0.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all ms-0.5"
                    title={t("removeFromSidebar")}
                    aria-label={t("removeFromSidebar")}
                  >
                    <IconX className="size-3" />
                  </button>
                </div>
              )
            })
          })}
        </div>
      </nav>
    </header>

    {/* Slider when there are too many items in the editor */}
    {navScrollState.hasOverflow && (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-border/60 bg-card/60 backdrop-blur-md text-xs shadow-2xs">
        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 select-none">
          <IconArrowsHorizontal className="size-3.5 text-primary" />
          <span className="text-[11px] font-medium">Scroll items</span>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md mx-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 cursor-pointer rounded-lg text-muted-foreground hover:text-foreground"
            onPress={() =>
              editorNavRef.current?.scrollBy({ left: -160, behavior: "smooth" })
            }
            aria-label="Scroll left"
          >
            <IconChevronLeft className="size-3.5" />
          </Button>

          <div className="flex-1">
            <Slider
              aria-label="Scroll navbar items"
              minValue={0}
              maxValue={navScrollState.maxScroll}
              value={navScrollState.scrollLeft}
              onChange={(val) => {
                if (editorNavRef.current) {
                  const v = Array.isArray(val) ? val[0] : val
                  editorNavRef.current.scrollLeft = v
                }
              }}
              className="w-full cursor-pointer"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 cursor-pointer rounded-lg text-muted-foreground hover:text-foreground"
            onPress={() =>
              editorNavRef.current?.scrollBy({ left: 160, behavior: "smooth" })
            }
            aria-label="Scroll right"
          >
            <IconChevronRight className="size-3.5" />
          </Button>
        </div>

        <div className="text-[10px] text-muted-foreground shrink-0 select-none tabular-nums font-mono">
          {Math.round(
            (navScrollState.scrollLeft / (navScrollState.maxScroll || 1)) * 100
          )}
          %
        </div>
      </div>
    )}
  </div>
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
              if (dropTarget?.key !== "new-section-dropzone-top") {
                setDropTarget({ type: "section-zone", key: "new-section-dropzone-top" })
              }
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const raw = e.dataTransfer?.getData("application/iris-dnd")
              let payload: DragPayload | null = dragged
              if (raw) {
                try {
                  payload = JSON.parse(raw)
                } catch {}
              }
              handleDropToNewSection(payload)
            }}
            className={cn(
              "rounded-xl transition-all",
              dropTarget?.key === "new-section-dropzone-top" && "ring-2 ring-primary scale-105"
            )}
          >
            <Button
              type="button"
              variant="default"
              size="xs"
              onPress={() => setAddSectionOpen(true)}
              className="cursor-pointer gap-1.5 rounded-xl text-[11px] font-semibold text-primary-foreground shadow-xs"
            >
              <IconPlus className="size-3.5" />
              <span>Add Section</span>
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onPress={onOpenCreateGroup}
            className="cursor-pointer gap-1.5 rounded-xl text-[11px] text-muted-foreground hover:text-foreground"
          >
            <IconFolders className="size-3.5" />
            <span>{t("createCustomGroup")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onPress={onOpenCreateLink}
            className="cursor-pointer gap-1.5 rounded-xl text-[11px] text-muted-foreground hover:text-foreground"
          >
            <IconLink className="size-3.5" />
            <span>{t("addCustomLink")}</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onPress={onResetLayout}
            className="cursor-pointer gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <IconRotate2 className="size-3" />
            <span>{t("resetSectionLayout")}</span>
          </Button>
        </div>
      </div>

      {/* Main Layout Area based on position:
          - If horizontal (top / bottom): Render actual horizontal navbar on top, and inventory below!
          - If vertical (left / right):
              - If left: Actual sidebar on Left (1 side) and Inventory next to it on Right!
              - If right: Inventory on Left and Actual sidebar on Right (1 side)!
      */}
      {isHorizontal ? (
        <div className="flex flex-col gap-5 w-full">
          {/* Top: Actual IRIS Navbar */}
          <div className="w-full">{renderActualHorizontalNavbar}</div>

          {/* Below: Available Inventory */}
          <div className="w-full">{renderInventoryPanel}</div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {isRight ? (
            <>
              {/* Inventory on Left */}
              <div className="flex-1 w-full order-1 min-w-0">
                {renderInventoryPanel}
              </div>

              {/* Actual IRIS Sidebar on Right */}
              <div className="w-full lg:w-[300px] shrink-0 order-2">
                {renderActualVerticalSidebar}
              </div>
            </>
          ) : (
            <>
              {/* Actual IRIS Sidebar on Left */}
              <div className="w-full lg:w-[300px] shrink-0 order-1">
                {renderActualVerticalSidebar}
              </div>

              {/* Inventory on Right */}
              <div className="flex-1 w-full order-2 min-w-0">
                {renderInventoryPanel}
              </div>
            </>
          )}
        </div>
      )}

      {/* Merge 2 Items Dialog */}
      <Dialog
        isOpen={mergeModal !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setMergeModal(null)
        }}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <IconFolders className="size-5 text-primary" />
            <span>Create Named Section</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Group <strong className="text-foreground">{mergeModal?.targetItem.label}</strong> and{" "}
            <strong className="text-foreground">{mergeModal?.sourceItem.label}</strong> into a named section. You can rename this section anytime.
          </p>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirmMerge()
          }}
          className="flex flex-col gap-4 py-2"
        >
          {/* Group Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Section Title
            </label>
            <Input
              value={mergeGroupName}
              onChange={(e) => setMergeGroupName(e.target.value)}
              placeholder={
                mergeModal?.targetItem.label
                  ? `${mergeModal.targetItem.label} & More`
                  : "e.g. Media, Favorites, Tools..."
              }
              className="h-9 text-xs"
              autoFocus
            />
          </div>

          {/* Type Selection: Dropdown Section vs Arrow Menu */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              Display Style
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: Dropdown Section (like Library) */}
              <button
                type="button"
                onClick={() => setMergeGroupType("section")}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-start transition-all cursor-pointer select-none",
                  mergeGroupType === "section"
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                    : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "p-1.5 rounded-lg",
                      mergeGroupType === "section"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <IconFolders className="size-4" />
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    Dropdown
                  </span>
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Top-level menu with title & dropdown (like Library)
                </p>
              </button>

              {/* Option 2: Main Item with Arrow Menu (like Browse) */}
              <button
                type="button"
                onClick={() => setMergeGroupType("folder")}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-start transition-all cursor-pointer select-none",
                  mergeGroupType === "folder"
                    ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                    : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "p-1.5 rounded-lg",
                      mergeGroupType === "folder"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <IconFolder className="size-4" />
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    Arrow Menu
                  </span>
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Direct pill with split arrow (like Browse)
                </p>
              </button>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onPress={() => setMergeModal(null)}
              className="cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              className="cursor-pointer text-xs font-semibold"
            >
              {mergeGroupType === "folder" ? "Create Arrow Menu" : "Create Section"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Merge 2 Sections Dialog */}
      <Dialog
        isOpen={mergeSectionsModal !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setMergeSectionsModal(null)
        }}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <IconFolders className="size-5 text-primary" />
            <span>Merge Sections</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Merge all items from{" "}
            <strong className="text-foreground">
              {mergeSectionsModal?.sourceTitle}
            </strong>{" "}
            into{" "}
            <strong className="text-foreground">
              {mergeSectionsModal?.targetTitle}
            </strong>
            .
          </p>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirmMergeSections()
          }}
          className="flex flex-col gap-4 py-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Merged Section Title
            </label>
            <Input
              value={mergedSectionName}
              onChange={(e) => setMergedSectionName(e.target.value)}
              placeholder="e.g. Media, Favorites, Tools..."
              className="h-9 text-xs"
              autoFocus
            />
            {/* Quick title suggestions */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {mergeSectionsModal?.targetTitle && (
                <button
                  type="button"
                  onClick={() => setMergedSectionName(mergeSectionsModal.targetTitle)}
                  className="cursor-pointer rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Keep "{mergeSectionsModal.targetTitle}"
                </button>
              )}
              {mergeSectionsModal?.sourceTitle &&
                mergeSectionsModal?.targetTitle &&
                mergeSectionsModal.sourceTitle !== mergeSectionsModal.targetTitle && (
                  <button
                    type="button"
                    onClick={() =>
                      setMergedSectionName(
                        `${mergeSectionsModal.targetTitle} & ${mergeSectionsModal.sourceTitle}`
                      )
                    }
                    className="cursor-pointer rounded-lg border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    Combine: "{mergeSectionsModal.targetTitle} & {mergeSectionsModal.sourceTitle}"
                  </button>
                )}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onPress={() => setMergeSectionsModal(null)}
              className="cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              className="cursor-pointer text-xs font-semibold"
            >
              Merge Sections
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Direct Add Section Dialog */}
      <Dialog
        isOpen={addSectionOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setAddSectionOpen(false)
            setNewSectionName("")
          }
        }}
        className="sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <IconFolders className="size-5 text-primary" />
            <span>Add New Section</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Create a new section in your sidebar to organize items and shortcuts.
          </p>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleCreateNewSection()
          }}
          className="flex flex-col gap-4 py-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Section Title
            </label>
            <Input
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="e.g. Media, Favorites, Tools..."
              className="h-9 text-xs"
              autoFocus
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onPress={() => {
                setAddSectionOpen(false)
                setNewSectionName("")
              }}
              className="cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              isDisabled={!newSectionName.trim()}
              className="cursor-pointer text-xs font-semibold"
            >
              Add Section
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Rename Section Dialog */}
      <Dialog
        isOpen={renameModal !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRenameModal(null)
        }}
        className="sm:max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <IconPencil className="size-5 text-primary" />
            <span>Rename Section</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Change the name of this navigation section, or leave it blank to display as standalone items.
          </p>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirmRename()
          }}
          className="flex flex-col gap-4 py-2"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Section Title
            </label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="e.g. Media, Favorites, Tools (or empty for standalone)"
              className="h-9 text-xs"
              autoFocus
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onPress={() => setRenameModal(null)}
              className="cursor-pointer text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              className="cursor-pointer text-xs font-semibold"
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}

export default SidebarCanvasEditor
