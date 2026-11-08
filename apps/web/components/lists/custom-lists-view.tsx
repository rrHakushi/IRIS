"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "@/context/session-context"
import {
  IconListDetails,
  IconPlus,
  IconLock,
  IconWorld,
  IconTrash,
  IconChevronRight,
  IconChevronUp,
  IconChevronDown,
  IconSearch,
  IconLoader2,
  IconUsers,
  IconUserPlus,
  IconArrowsSort,
  IconGripVertical,
  IconMessageCircle,
  IconChartBar,
  IconClockHour4,
  IconCheck,
  IconX,
  IconEdit,
  IconStar,
  IconArrowLeft,
  IconStack2,
  IconClock,
  IconCalendarEvent,
  IconChartDots,
  IconDeviceTv,
  IconBook2,
  IconMovie,
  IconDeviceGamepad,
  IconBook,
  IconMusic,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Separator } from "@workspace/ui/components/separator"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { toast } from "sonner"
import { elysia, API_URL } from "@/lib/elysia"
import { getMediaDetailHref } from "@/lib/media-routes"
import { UserListBanner } from "./user-list-banner"
import type { UserProfileCustomization } from "@IRIS/shared"
import { cn } from "@workspace/ui/lib/utils"
import { useEncryption } from "@/context/encryption-context"
import { deriveVaultKey, safeDecryptText } from "@/lib/client-encryption"
import { BorealisCard, BorealisCardGroup } from "@Runa/borealis"
import { MultiSelectFilterPopover } from "./multi-select-filter-popover"
import { ScoreDistributionChart } from "./stats/score-distribution-chart"
import { YearTimelineChart } from "./stats/year-timeline-chart"
import { GenreStudioBreakdown } from "./stats/genre-studio-breakdown"
import { FormatCountryDistribution } from "./stats/format-country-distribution"

export interface CustomListsViewProps {
  username: string
  userId?: string
  initialProfile?: UserProfileCustomization | null
}

export type CustomListTab = "list" | "comments" | "stats" | "activity"

export interface CustomListItem {
  id: string
  userId: string
  name: string
  description: string | null
  isPrivate: boolean
  isDefault: boolean
  coverImage: string | null
  covers?: string[]
  order: number
  entriesCount: number
  role?: "OWNER" | "EDITOR" | "VIEWER"
  isOwner?: boolean
  owner?: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export interface CustomListEntryItem {
  entry: {
    id: string
    listId: string
    mediaType: string
    mediaId: number
    order: number
    customNotes: string | null
    addedAt: string
  }
  media: any
}

export interface CollaboratorItem {
  id: string
  userId: string
  role: "EDITOR" | "VIEWER"
  createdAt: string
  user: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

export interface CustomListCommentItem {
  id: string
  listOwnerId: string
  customListId: string
  authorId: string
  content: string
  isSpoiler: boolean
  createdAt: string
  updatedAt: string
  author: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

export interface CustomListActivityItem {
  id: string
  type: string
  user: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
  content: string | null
  metadata: any
  createdAt: string
}

const MEDIA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ANIME: IconDeviceTv,
  MANGA: IconBook2,
  MOVIE: IconMovie,
  TV: IconDeviceTv,
  GAME: IconDeviceGamepad,
  BOOK: IconBook,
  MUSIC: IconMusic,
}

let inflightPlaylistsPromise: Promise<any> | null = null

export function CustomListCoverBanner({
  covers,
  fallbackImage,
  count,
  name,
}: {
  covers?: string[]
  fallbackImage?: string | null
  count?: number
  name?: string
}) {
  const validCovers = (covers ?? []).filter(Boolean)

  if (validCovers.length >= 2) {
    const sliceCovers = validCovers.slice(0, 5)
    return (
      <div className="relative size-full overflow-hidden bg-zinc-950">
        <div className="relative flex size-full -skew-x-14 scale-115">
          {sliceCovers.map((c, i) => (
            <div
              key={i}
              className={cn(
                "relative h-full flex-1 overflow-hidden border-e-[2.5px] border-black",
                i === 0 && "-ms-4",
                i === sliceCovers.length - 1 && "-me-4 border-e-0"
              )}
            >
              <div className="relative size-full skew-x-14 scale-135">
                <Image
                  src={c}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover object-center"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        {count !== undefined && count > 0 && (
          <div className="absolute bottom-2 end-2 z-10 font-mono text-[10px] font-bold text-white/95 bg-black/80 px-2 py-0.5 rounded backdrop-blur-md shadow-md border border-white/10">
            {count}
          </div>
        )}
      </div>
    )
  }

  if (validCovers.length === 1 || fallbackImage) {
    const src = validCovers[0] || fallbackImage!
    return (
      <div className="relative size-full overflow-hidden bg-zinc-950">
        <Image
          src={src}
          alt={name || "Custom list cover"}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {count !== undefined && count > 0 && (
          <div className="absolute bottom-2 end-2 z-10 font-mono text-[10px] font-bold text-white/90 bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-md">
            {count}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex size-full items-center justify-center text-muted-foreground/40 group-hover:text-primary transition-colors bg-muted/40">
      <IconListDetails className="size-10 stroke-[1.5]" />
    </div>
  )
}

export function CustomListsView({
  username,
  userId,
  initialProfile,
}: CustomListsViewProps): React.JSX.Element {
  const { data: session } = useSession()
  const isPageOwner = Boolean(
    (userId && session?.user?.id === userId) ||
    session?.user?.username === username
  )

  const { secretKey, isActive } = useEncryption()
  const vaultKey = useMemo(
    () => (isActive && secretKey ? deriveVaultKey(secretKey) : null),
    [isActive, secretKey]
  )

  // Navigation & Lists State
  const [lists, setLists] = useState<CustomListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedList, setSelectedList] = useState<CustomListItem | null>(null)
  const [activeTab, setActiveTab] = useState<CustomListTab>("list")
  const [overviewSearchQuery, setOverviewSearchQuery] = useState("")

  // Entries State
  const [entries, setEntries] = useState<CustomListEntryItem[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [entrySearchQuery, setEntrySearchQuery] = useState("")
  const [selectedMediaTypes, setSelectedMediaTypes] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<"order" | "title" | "addedAt">("order")

  // Edit Mode State (Reordering & Metadata Editing)
  const [isEditMode, setIsEditMode] = useState(false)
  const [reorderedEntries, setReorderedEntries] = useState<CustomListEntryItem[]>([])
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editIsPrivate, setEditIsPrivate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  // Collaborators State
  const [collaboratorsDialogOpen, setCollaboratorsDialogOpen] = useState(false)
  const [collaborators, setCollaborators] = useState<CollaboratorItem[]>([])
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false)
  const [collabSearchUsername, setCollabSearchUsername] = useState("")
  const [collabRole, setCollabRole] = useState<"EDITOR" | "VIEWER">("EDITOR")
  const [invitingCollab, setInvitingCollab] = useState(false)

  // Comments State
  const [comments, setComments] = useState<CustomListCommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newCommentText, setNewCommentText] = useState("")
  const [newCommentSpoiler, setNewCommentSpoiler] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Activity State
  const [activity, setActivity] = useState<CustomListActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Create List Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [newListDescription, setNewListDescription] = useState("")
  const [newListIsPrivate, setNewListIsPrivate] = useState(false)
  const [creating, setCreating] = useState(false)

  // Permissions for currently selected list
  const isListOwner = Boolean(
    selectedList &&
    (selectedList.isOwner !== false &&
      (selectedList.userId === session?.user?.id ||
        (isPageOwner && selectedList.role !== "EDITOR" && selectedList.role !== "VIEWER")))
  )
  const canEditList = Boolean(isListOwner || selectedList?.role === "EDITOR")

  // ---------------------------------------------------------------------------
  // URL Param Sync: ?list=<listId>
  // ---------------------------------------------------------------------------
  const updateUrlParam = useCallback((listId: string | null) => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (listId) {
      url.searchParams.set("list", listId)
    } else {
      url.searchParams.delete("list")
    }
    window.history.pushState({}, "", url.toString())
  }, [])

  // ---------------------------------------------------------------------------
  // Data Fetching: Lists
  // ---------------------------------------------------------------------------
  const fetchLists = useCallback(async (force = false) => {
    setLoading(true)
    try {
      if (force) {
        inflightPlaylistsPromise = null
      }
      if (!inflightPlaylistsPromise) {
        inflightPlaylistsPromise = elysia.borealis.playlists.get().finally(() => {
          setTimeout(() => {
            inflightPlaylistsPromise = null
          }, 400)
        })
      }
      const { data, error } = await inflightPlaylistsPromise
      if (!error && (data as any)?.playlists) {
        const fetchedLists: CustomListItem[] = (data as any).playlists
        setLists(fetchedLists)

        // Check if URL has ?list=<id> parameter
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search)
          const listIdParam = params.get("list")
          if (listIdParam) {
            const matched = fetchedLists.find((l) => l.id === listIdParam)
            if (matched) {
              setSelectedList(matched)
            }
          }
        }
      }
    } catch {
      toast.error("Failed to load custom lists")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  // Handle browser popstate navigation
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      const listIdParam = params.get("list")
      if (listIdParam) {
        const matched = lists.find((l) => l.id === listIdParam)
        if (matched) {
          setSelectedList(matched)
          return
        }
      }
      setSelectedList(null)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [lists])

  // ---------------------------------------------------------------------------
  // Select List & Back Handlers
  // ---------------------------------------------------------------------------
  const handleSelectList = (list: CustomListItem) => {
    setSelectedList(list)
    setIsEditMode(false)
    updateUrlParam(list.id)
  }

  const handleBackToOverview = () => {
    setSelectedList(null)
    setIsEditMode(false)
    updateUrlParam(null)
  }

  // ---------------------------------------------------------------------------
  // Data Fetching: Entries for Selected List
  // ---------------------------------------------------------------------------
  const fetchEntries = useCallback(
    async (playlistId: string) => {
      setEntriesLoading(true)
      try {
        const { data, error } = await elysia.borealis
          .playlists({ playlistId })
          .entries.get({ query: { limit: 100 } })

        if (!error && (data as any)?.items) {
          const rawItems = (data as any).items
          const decryptedItems: CustomListEntryItem[] = rawItems.map((item: any) => ({
            ...item,
            entry: {
              ...item.entry,
              customNotes: safeDecryptText(item.entry.customNotes, vaultKey),
            },
          }))
          setEntries(decryptedItems)
          setReorderedEntries(decryptedItems)
          setHasUnsavedChanges(false)
        }
      } catch {
        toast.error("Failed to load list entries")
      } finally {
        setEntriesLoading(false)
      }
    },
    [vaultKey]
  )

  useEffect(() => {
    if (selectedList) {
      fetchEntries(selectedList.id)
      setEditName(selectedList.name)
      setEditDescription(selectedList.description || "")
      setEditIsPrivate(selectedList.isPrivate)
    }
  }, [selectedList?.id, fetchEntries])

  // ---------------------------------------------------------------------------
  // Data Fetching: Comments
  // ---------------------------------------------------------------------------
  const fetchComments = useCallback(async (playlistId: string) => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`${API_URL}/borealis/playlists/${playlistId}/comments?limit=50`, {
        credentials: "include",
      })
      const json = await res.json()
      if (json?.comments) {
        setComments(json.comments)
      }
    } catch {
      toast.error("Failed to load comments")
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Data Fetching: Activity
  // ---------------------------------------------------------------------------
  const fetchActivity = useCallback(async (playlistId: string) => {
    setActivityLoading(true)
    try {
      const res = await fetch(`${API_URL}/borealis/playlists/${playlistId}/activity`, {
        credentials: "include",
      })
      const json = await res.json()
      if (json?.activity) {
        setActivity(json.activity)
      }
    } catch {
      toast.error("Failed to load activity")
    } finally {
      setActivityLoading(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Data Fetching: Collaborators
  // ---------------------------------------------------------------------------
  const fetchCollaborators = useCallback(async (playlistId: string) => {
    setCollaboratorsLoading(true)
    try {
      const res = await fetch(`${API_URL}/borealis/playlists/${playlistId}/collaborators`, {
        credentials: "include",
      })
      const json = await res.json()
      if (json?.collaborators) {
        setCollaborators(json.collaborators)
      }
    } catch {
      toast.error("Failed to load collaborators")
    } finally {
      setCollaboratorsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedList) return
    if (activeTab === "comments") {
      fetchComments(selectedList.id)
    } else if (activeTab === "activity") {
      fetchActivity(selectedList.id)
    }
  }, [activeTab, selectedList?.id, fetchComments, fetchActivity])

  // ---------------------------------------------------------------------------
  // Create / Delete Custom List Handlers
  // ---------------------------------------------------------------------------
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim() || creating) return

    setCreating(true)
    try {
      const { data, error } = await elysia.borealis.playlists.post({
        name: newListName.trim(),
        description: newListDescription.trim() || undefined,
        isPrivate: newListIsPrivate,
      })

      if (error || !(data as any)?.playlist) {
        toast.error("Failed to create custom list")
        return
      }

      const created = (data as any).playlist
      setLists((prev) => [created, ...prev])
      setSelectedList(created)
      updateUrlParam(created.id)
      setCreateDialogOpen(false)
      setNewListName("")
      setNewListDescription("")
      setNewListIsPrivate(false)
      toast.success(`Created custom list "${created.name}"`)
    } catch {
      toast.error("An error occurred while creating custom list")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteList = async () => {
    if (!selectedList) return
    if (!confirm(`Are you sure you want to permanently delete "${selectedList.name}"? This cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`${API_URL}/borealis/playlists/${selectedList.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.detail || "Failed to delete list")
        return
      }

      toast.success(`Deleted "${selectedList.name}"`)
      const remaining = lists.filter((l) => l.id !== selectedList.id)
      setLists(remaining)
      setSelectedList(null)
      updateUrlParam(null)
    } catch {
      toast.error("Failed to delete list")
    }
  }

  // ---------------------------------------------------------------------------
  // Reordering & Edit Mode Handlers
  // ---------------------------------------------------------------------------
  const handleMoveEntry = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= reorderedEntries.length) return

    const copy = [...reorderedEntries]
    const [moved] = copy.splice(idx, 1)
    if (!moved) return
    copy.splice(targetIdx, 0, moved)

    setReorderedEntries(copy)
    setHasUnsavedChanges(true)
  }

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === targetIdx) return

    const copy = [...reorderedEntries]
    const [dragged] = copy.splice(draggedIdx, 1)
    if (!dragged) return
    copy.splice(targetIdx, 0, dragged)

    setDraggedIdx(targetIdx)
    setReorderedEntries(copy)
    setHasUnsavedChanges(true)
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
  }

  const handleSaveEditChanges = async () => {
    if (!selectedList || isSaving) return
    setIsSaving(true)
    try {
      // 1. Save list metadata (title, description, privacy) if changed
      const metaChanged =
        editName.trim() !== selectedList.name ||
        (editDescription.trim() || null) !== selectedList.description ||
        editIsPrivate !== selectedList.isPrivate

      if (metaChanged) {
        const patchRes = await fetch(`${API_URL}/borealis/playlists/${selectedList.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: editName.trim(),
            description: editDescription.trim() || null,
            isPrivate: editIsPrivate,
          }),
        })
        const patchJson = await patchRes.json()
        if (!patchRes.ok) {
          toast.error(patchJson?.detail || "Failed to update list details")
          return
        }

        const updated = patchJson.playlist
        setSelectedList(updated)
        setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      }

      // 2. Save reordered entries
      const entryIds = reorderedEntries.map((e) => e.entry.id)
      const reorderRes = await fetch(`${API_URL}/borealis/playlists/${selectedList.id}/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entryIds }),
      })
      if (!reorderRes.ok) {
        const json = await reorderRes.json()
        toast.error(json?.detail || "Failed to save order")
        return
      }

      setEntries(reorderedEntries)
      setHasUnsavedChanges(false)
      toast.success("Saved changes")
      setIsEditMode(false)
    } catch {
      toast.error("Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveEntry = async (item: CustomListEntryItem) => {
    if (!selectedList) return
    try {
      const res = await fetch(
        `${API_URL}/borealis/playlists/${selectedList.id}/entries?id=${item.entry.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      )
      if (!res.ok) {
        toast.error("Failed to remove item")
        return
      }

      setEntries((prev) => prev.filter((e) => e.entry.id !== item.entry.id))
      setReorderedEntries((prev) => prev.filter((e) => e.entry.id !== item.entry.id))
      setLists((prev) =>
        prev.map((l) =>
          l.id === selectedList.id
            ? { ...l, entriesCount: Math.max(0, l.entriesCount - 1) }
            : l
        )
      )
      toast.info("Removed from list")
    } catch {
      toast.error("Failed to remove item")
    }
  }

  // ---------------------------------------------------------------------------
  // Collaborator Handlers
  // ---------------------------------------------------------------------------
  const handleOpenCollaborators = () => {
    if (!selectedList) return
    setCollaboratorsDialogOpen(true)
    fetchCollaborators(selectedList.id)
  }

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedList || !collabSearchUsername.trim() || invitingCollab) return

    setInvitingCollab(true)
    try {
      const res = await fetch(`${API_URL}/borealis/playlists/${selectedList.id}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: collabSearchUsername.trim(),
          role: collabRole,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.detail || json?.message || "Failed to add collaborator")
        return
      }

      toast.success(json.message || `Added @${collabSearchUsername.trim()}`)
      setCollabSearchUsername("")
      fetchCollaborators(selectedList.id)
    } catch {
      toast.error("Failed to add collaborator")
    } finally {
      setInvitingCollab(false)
    }
  }

  const handleUpdateCollaboratorRole = async (collabId: string, newRole: "EDITOR" | "VIEWER") => {
    if (!selectedList) return
    try {
      const res = await fetch(
        `${API_URL}/borealis/playlists/${selectedList.id}/collaborators/${collabId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: newRole }),
        }
      )
      if (!res.ok) {
        toast.error("Failed to update role")
        return
      }

      setCollaborators((prev) =>
        prev.map((c) => (c.id === collabId ? { ...c, role: newRole } : c))
      )
      toast.success(`Role updated to ${newRole}`)
    } catch {
      toast.error("Failed to update role")
    }
  }

  const handleRemoveCollaborator = async (collabId: string, name: string) => {
    if (!selectedList) return
    try {
      const res = await fetch(
        `${API_URL}/borealis/playlists/${selectedList.id}/collaborators/${collabId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      )
      if (!res.ok) {
        toast.error("Failed to remove collaborator")
        return
      }

      toast.success(`Removed @${name}`)
      setCollaborators((prev) => prev.filter((c) => c.id !== collabId))
    } catch {
      toast.error("Failed to remove collaborator")
    }
  }

  // ---------------------------------------------------------------------------
  // Comments Handlers
  // ---------------------------------------------------------------------------
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedList || !newCommentText.trim() || submittingComment) return

    setSubmittingComment(true)
    try {
      const res = await fetch(`${API_URL}/borealis/playlists/${selectedList.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: newCommentText.trim(),
          isSpoiler: newCommentSpoiler,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.detail || "Failed to post comment")
        return
      }

      setNewCommentText("")
      setNewCommentSpoiler(false)
      toast.success("Comment posted")
      if (json.comment) {
        setComments((prev) => [json.comment, ...prev])
      } else {
        fetchComments(selectedList.id)
      }
    } catch {
      toast.error("Failed to post comment")
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedList) return
    try {
      const res = await fetch(
        `${API_URL}/borealis/playlists/${selectedList.id}/comments/${commentId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      )
      if (!res.ok) {
        toast.error("Failed to delete comment")
        return
      }

      toast.success("Comment deleted")
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch {
      toast.error("Failed to delete comment")
    }
  }

  // ---------------------------------------------------------------------------
  // Media Type Options for MultiSelectFilterPopover
  // ---------------------------------------------------------------------------
  const mediaTypeOptions = useMemo(() => {
    const counts: Record<string, number> = {}
    entries.forEach((e) => {
      const t = e.entry.mediaType.toUpperCase()
      const norm = t.includes("MUSIC") ? "MUSIC" : t
      counts[norm] = (counts[norm] || 0) + 1
    })

    return Object.entries(counts).map(([type, count]) => ({
      value: type,
      label: type.charAt(0) + type.slice(1).toLowerCase(),
      count,
    }))
  }, [entries])

  // ---------------------------------------------------------------------------
  // Filtering & Sorting of Entries
  // ---------------------------------------------------------------------------
  const currentEntries = isEditMode ? reorderedEntries : entries

  const filteredEntries = useMemo(() => {
    return currentEntries.filter((item) => {
      // Media type multi-select filter
      if (selectedMediaTypes.length > 0) {
        const itemType = item.entry.mediaType.toUpperCase()
        const norm = itemType.includes("MUSIC") ? "MUSIC" : itemType
        if (!selectedMediaTypes.includes(norm)) {
          return false
        }
      }

      // Search query filter
      if (entrySearchQuery.trim()) {
        const q = entrySearchQuery.toLowerCase().trim()
        const titlePrimary = item.media?.titlePrimary?.toLowerCase() || ""
        const titleEnglish = item.media?.titleEnglish?.toLowerCase() || ""
        const titleRomaji = item.media?.titleRomaji?.toLowerCase() || ""
        const artist = item.media?.artistName?.toLowerCase() || ""
        const notes = item.entry.customNotes?.toLowerCase() || ""
        return (
          titlePrimary.includes(q) ||
          titleEnglish.includes(q) ||
          titleRomaji.includes(q) ||
          artist.includes(q) ||
          notes.includes(q)
        )
      }

      return true
    }).sort((a, b) => {
      if (isEditMode || sortBy === "order") {
        return a.entry.order - b.entry.order
      }
      if (sortBy === "title") {
        const tA = a.media?.titlePrimary || ""
        const tB = b.media?.titlePrimary || ""
        return tA.localeCompare(tB)
      }
      if (sortBy === "addedAt") {
        return new Date(b.entry.addedAt).getTime() - new Date(a.entry.addedAt).getTime()
      }
      return 0
    })
  }, [currentEntries, selectedMediaTypes, entrySearchQuery, sortBy, isEditMode])

  // ---------------------------------------------------------------------------
  // Stats Calculation for Entries in Selected List
  // ---------------------------------------------------------------------------
  const customListStats = useMemo(() => {
    const totalTitles = entries.length
    if (totalTitles === 0) return null

    let scoredCount = 0
    let totalScoreSum = 0
    const scoreMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }
    let unratedCount = 0

    const mediaCounts: Record<string, number> = {}
    const releaseYears: Record<number, number> = {}
    const genresMap: Record<string, { count: number; scoreSum: number; scored: number }> = {}
    const creatorsMap: Record<string, { count: number; scoreSum: number; scored: number }> = {}
    const formatMap: Record<string, number> = {}
    const statusMap: Record<string, number> = {}
    let totalMinutes = 0

    entries.forEach((item) => {
      const type = item.entry.mediaType.toUpperCase()
      const normType = type.includes("MUSIC") ? "MUSIC" : type
      mediaCounts[normType] = (mediaCounts[normType] || 0) + 1

      // Scores
      const rawScore = item.media?.averageScore
      if (typeof rawScore === "number" && rawScore > 0) {
        const rounded = Math.min(10, Math.max(1, Math.round(rawScore > 10 ? rawScore / 10 : rawScore)))
        scoreMap[rounded] = (scoreMap[rounded] || 0) + 1
        scoredCount++
        totalScoreSum += rawScore > 10 ? rawScore / 10 : rawScore
      } else {
        unratedCount++
      }

      // Formats & Statuses
      if (item.media?.format) {
        formatMap[item.media.format] = (formatMap[item.media.format] || 0) + 1
      }
      if (item.media?.status) {
        statusMap[item.media.status] = (statusMap[item.media.status] || 0) + 1
      }

      // Year
      const year =
        item.media?.startDate?.year ||
        (item.media?.releaseDate ? new Date(item.media.releaseDate).getFullYear() : null)
      if (year && year > 1950 && year < 2050) {
        releaseYears[year] = (releaseYears[year] || 0) + 1
      }

      // Duration estimate
      const episodes = item.media?.episodes || 1
      const duration = item.media?.duration || (normType === "MOVIE" ? 110 : 24)
      totalMinutes += episodes * duration

      // Genres
      if (Array.isArray(item.media?.genres)) {
        item.media.genres.forEach((g: any) => {
          const name = typeof g === "string" ? g : g?.genre?.name || g?.name
          if (name) {
            if (!genresMap[name]) genresMap[name] = { count: 0, scoreSum: 0, scored: 0 }
            genresMap[name]!.count++
            if (rawScore) {
              genresMap[name]!.scoreSum += rawScore > 10 ? rawScore / 10 : rawScore
              genresMap[name]!.scored++
            }
          }
        })
      }

      // Studios / Creators
      const creator = item.media?.artistName || item.media?.studios?.[0]?.name || null
      if (creator) {
        if (!creatorsMap[creator]) creatorsMap[creator] = { count: 0, scoreSum: 0, scored: 0 }
        creatorsMap[creator]!.count++
      }
    })

    const meanScore = scoredCount > 0 ? totalScoreSum / scoredCount : 0
    let varianceSum = 0
    entries.forEach((item) => {
      const rawScore = item.media?.averageScore
      if (typeof rawScore === "number" && rawScore > 0) {
        const s = rawScore > 10 ? rawScore / 10 : rawScore
        varianceSum += Math.pow(s - meanScore, 2)
      }
    })
    const standardDeviation = scoredCount > 1 ? Math.sqrt(varianceSum / scoredCount) : 0

    const hoursConsumed = Math.round(totalMinutes / 60)
    const daysConsumed = (hoursConsumed / 24).toFixed(1)

    const mediaBreakdown = Object.entries(mediaCounts).map(([type, count]) => ({
      mediaType: type.toLowerCase(),
      count,
      percentage: Math.round((count / totalTitles) * 100),
      meanScore,
      hours: Math.round((count * 120) / 60),
    }))

    const scores = Object.entries(scoreMap).map(([scoreStr, count]) => ({
      score: Number(scoreStr),
      count,
    }))

    const releaseYearGraph = Object.entries(releaseYears)
      .map(([year, count]) => ({
        year: Number(year),
        count,
        titles: count,
        meanScore: 0,
        hours: 0,
      }))
      .sort((a, b) => a.year - b.year)

    const topGenres = Object.entries(genresMap)
      .map(([name, data]) => ({
        genre: name,
        count: data.count,
        meanScore: data.scored > 0 ? Number((data.scoreSum / data.scored).toFixed(1)) : 0,
        hours: 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const topCreators = Object.entries(creatorsMap)
      .map(([name, data]) => ({ name, count: data.count, meanScore: 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const formatDistribution = Object.entries(formatMap).map(([format, count]) => ({
      name: format,
      count,
      percentage: Math.round((count / totalTitles) * 100),
    }))

    const statusDistribution = Object.entries(statusMap).map(([status, count]) => ({
      name: status,
      count,
      percentage: Math.round((count / totalTitles) * 100),
    }))

    return {
      overview: {
        totalTitles,
        daysConsumed: Number(daysConsumed),
        daysPlanned: 0,
        meanScore,
        standardDeviation,
        scoredCount,
      },
      mediaBreakdown,
      scoreDistribution: {
        scores,
        unratedCount,
      },
      releaseYearGraph,
      topGenres,
      topCreators,
      formatDistribution,
      statusDistribution,
    }
  }, [entries])

  // Overview lists filtered by overviewSearchQuery
  const filteredListsOverview = useMemo(() => {
    if (!overviewSearchQuery.trim()) return lists
    const q = overviewSearchQuery.toLowerCase().trim()
    return lists.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.description && l.description.toLowerCase().includes(q))
    )
  }, [lists, overviewSearchQuery])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 1. Top User Banner */}
      <UserListBanner username={username} profile={initialProfile} />

      {/* 2. Main Container */}
      <main className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* ================================================================== */}
        {/* VIEW A: PLAYLISTS OVERVIEW (Like YouTube / Spotify Playlists)     */}
        {/* ================================================================== */}
        {!selectedList ? (
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                  Custom Lists
                </h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  Curated collections, marathons, and shared playlists.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search custom lists..."
                    value={overviewSearchQuery}
                    onChange={(e) => setOverviewSearchQuery(e.target.value)}
                    className="h-9 rounded-2xl ps-9 text-xs"
                  />
                </div>

                {isPageOwner && (
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    size="sm"
                    className="h-9 gap-1.5 rounded-2xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <IconPlus className="size-4" />
                    <span>New List</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Overview Lists Grid */}
            {loading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                <IconLoader2 className="size-6 animate-spin text-primary" />
                <span className="text-sm">Loading custom lists...</span>
              </div>
            ) : filteredListsOverview.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-frost bg-frost/50 p-12 text-center backdrop-blur-xl shadow-xl">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-frost bg-muted/50 text-muted-foreground">
                  <IconListDetails className="size-7 opacity-40" />
                </div>
                <h3 className="mt-4 font-heading text-base font-semibold text-foreground">
                  No custom lists found
                </h3>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {overviewSearchQuery
                    ? `No custom lists match "${overviewSearchQuery}".`
                    : isPageOwner
                    ? "Create your first custom collection to organize media across anime, movies, manga, and TV."
                    : `${username} hasn't created any public custom lists yet.`}
                </p>
                {isPageOwner && !overviewSearchQuery && (
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    size="sm"
                    className="mt-4 gap-1.5 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <IconPlus className="size-4" />
                    <span>Create Custom List</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredListsOverview.map((list) => {
                  const isShared = !list.isOwner && list.role && list.role !== "OWNER"

                  return (
                    <div
                      key={list.id}
                      onClick={() => handleSelectList(list)}
                      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-frost bg-frost p-5 backdrop-blur-xl transition-all hover:border-border hover:shadow-lg"
                    >
                      <div>
                        {/* Cover / Icon Area */}
                        <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-xl border border-border/40 bg-muted/40">
                          <CustomListCoverBanner
                            covers={list.covers}
                            fallbackImage={list.coverImage}
                            count={list.entriesCount}
                            name={list.name}
                          />

                          {/* Privacy & Shared Badges on Cover */}
                          <div className="absolute end-2 top-2 z-10 flex items-center gap-1">
                            {list.isPrivate && (
                              <Badge variant="secondary" className="gap-1 text-[10px] backdrop-blur-md">
                                <IconLock className="size-2.5" />
                                <span>Private</span>
                              </Badge>
                            )}
                            {isShared && (
                              <Badge variant="outline" className="gap-1 text-[10px] backdrop-blur-md">
                                <IconUsers className="size-2.5" />
                                <span>{list.role}</span>
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h3 className="line-clamp-1 font-heading text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                          {list.name}
                        </h3>

                        {list.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {list.description}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground/50 italic">
                            No description provided
                          </p>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-xs text-muted-foreground">
                        <span className="font-mono text-[11px]">
                          {list.entriesCount} {list.entriesCount === 1 ? "item" : "items"}
                        </span>
                        <div className="flex items-center gap-1 text-primary transition-transform group-hover:translate-x-0.5">
                          <span className="text-[11px] font-semibold">View</span>
                          <IconChevronRight className="size-3.5" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* ================================================================== */
          /* VIEW B: SELECTED CUSTOM LIST DETAIL VIEW                           */
          /* ================================================================== */
          <div className="space-y-6">
            {/* Back to All Lists Button */}
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToOverview}
                className="gap-1.5 rounded-full border-frost bg-frost text-xs font-semibold text-foreground hover:bg-muted/50"
              >
                <IconArrowLeft className="size-3.5" />
                <span>All Custom Lists</span>
              </Button>
            </div>

            {/* FROSTED TOOLBAR CARD */}
            <div className="rounded-2xl border border-frost bg-frost text-foreground shadow-xl backdrop-blur-2xl">
              {/* Top Row: Pills & Actions */}
              <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                {/* Left: Custom Lists Selector Pills */}
                <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pe-2">
                  {lists.map((list) => {
                    const isSelected = selectedList.id === list.id
                    const isShared = !list.isOwner && list.role && list.role !== "OWNER"

                    return (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => handleSelectList(list)}
                        className={cn(
                          "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold tracking-wider transition-all flex items-center gap-2",
                          isSelected
                            ? "border-border bg-muted/80 text-foreground shadow-sm"
                            : "border-frost bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                      >
                        <IconListDetails className="size-3.5 text-primary" />
                        <span className="max-w-[130px] truncate sm:max-w-[180px]">
                          {list.name}
                        </span>

                        {list.isPrivate && (
                          <IconLock className="size-3 text-muted-foreground" />
                        )}

                        {isShared && (
                          <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
                            <IconUsers className="size-2.5" />
                            <span>{list.role}</span>
                          </span>
                        )}
                      </button>
                    )
                  })}

                  {/* + New List Trigger */}
                  {isPageOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateDialogOpen(true)}
                      className="h-8 shrink-0 gap-1 rounded-full border-dashed border-frost bg-card/40 px-3 text-xs font-medium text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground"
                    >
                      <IconPlus className="size-3.5 text-primary" />
                      <span>New List</span>
                    </Button>
                  )}
                </div>

                {/* Right: Tab Switcher & Edit / Collab Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* View Switcher Tabs */}
                  <div className="h-8 gap-0.5 rounded-full border border-frost bg-frost/80 p-0.5 backdrop-blur-md flex items-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab("list")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all flex items-center gap-1.5",
                        activeTab === "list"
                          ? "bg-muted text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <IconListDetails className="size-3.5" />
                      <span>List</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("comments")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all flex items-center gap-1.5",
                        activeTab === "comments"
                          ? "bg-muted text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <IconMessageCircle className="size-3.5" />
                      <span>Comments</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("stats")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all flex items-center gap-1.5",
                        activeTab === "stats"
                          ? "bg-muted text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <IconChartBar className="size-3.5" />
                      <span>Stats</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("activity")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase transition-all flex items-center gap-1.5",
                        activeTab === "activity"
                          ? "bg-muted text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <IconClockHour4 className="size-3.5" />
                      <span>Activity</span>
                    </button>
                  </div>

                  {/* Edit Toggle (Owner & Editors) */}
                  {canEditList && activeTab === "list" && (
                    <Button
                      variant={isEditMode ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isEditMode && hasUnsavedChanges) {
                          if (!confirm("Exit edit mode without saving changes?")) return
                        }
                        setIsEditMode(!isEditMode)
                      }}
                      className={cn(
                        "h-8 gap-1.5 rounded-full border text-xs font-semibold",
                        isEditMode
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-frost bg-card/60 text-foreground hover:bg-muted/60"
                      )}
                    >
                      <IconEdit className="size-3.5" />
                      <span>{isEditMode ? "Done" : "Edit"}</span>
                    </Button>
                  )}

                  {/* Collaborators Dialog Trigger (Owner Only) */}
                  {isListOwner && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenCollaborators}
                      className="h-8 gap-1.5 rounded-full border border-frost bg-card/60 text-xs font-medium text-foreground hover:bg-muted/60"
                    >
                      <IconUsers className="size-3.5 text-primary" />
                      <span className="hidden sm:inline">Collaborators</span>
                    </Button>
                  )}

                  {/* Delete List Trigger (Owner Only) */}
                  {isListOwner && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleDeleteList}
                      aria-label="Delete custom list"
                      className="size-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Bottom Row: In-list Search & Multi-Select Media Filter */}
              {activeTab === "list" && (
                <>
                  <Separator className="bg-frost/40" />
                  <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
                    {/* Search inside the active list */}
                    <div className="relative max-w-md flex-1">
                      <IconSearch className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={`Search in "${selectedList.name}"...`}
                        value={entrySearchQuery}
                        onChange={(e) => setEntrySearchQuery(e.target.value)}
                        className="h-9 w-full rounded-2xl border border-frost bg-card/60 ps-9 pe-8 text-xs text-foreground placeholder:text-muted-foreground backdrop-blur-md"
                      />
                      {entrySearchQuery && (
                        <button
                          type="button"
                          onClick={() => setEntrySearchQuery("")}
                          className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <IconX className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Right: Multi-Select Media Filter & Sort */}
                    <div className="no-scrollbar flex flex-wrap items-center gap-2 overflow-x-auto pt-1 lg:pt-0">
                      {mediaTypeOptions.length > 0 && (
                        <MultiSelectFilterPopover
                          label="Media Types"
                          allLabel="All Media Types"
                          options={mediaTypeOptions}
                          selected={selectedMediaTypes}
                          onChange={setSelectedMediaTypes}
                        />
                      )}

                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="h-8 rounded-2xl border border-frost bg-card/80 px-2.5 text-xs text-foreground backdrop-blur-md focus:outline-none"
                      >
                        <option value="order">Custom Order</option>
                        <option value="title">Title (A-Z)</option>
                        <option value="addedAt">Date Added</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ================================================================ */}
            {/* TAB 1: LIST CONTENT                                              */}
            {/* ================================================================ */}
            {activeTab === "list" && (
              <div>
                {/* Edit Mode Panel: Edit Title, Description, Privacy & Reordering */}
                {isEditMode && (
                  <div className="space-y-4 mb-6 rounded-2xl border border-primary/40 bg-card/90 p-4 shadow-xl backdrop-blur-xl">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-3">
                      <div className="flex items-center gap-2">
                        <IconEdit className="size-5 text-primary" />
                        <div>
                          <h4 className="text-xs font-bold text-foreground">Edit List Details & Order</h4>
                          <p className="text-[11px] text-muted-foreground">
                            Update title, description, privacy, or reorder entries.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveEditChanges}
                          isDisabled={isSaving}
                          className="h-8 gap-1.5 rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          {isSaving ? (
                            <IconLoader2 className="size-3.5 animate-spin" />
                          ) : (
                            <IconCheck className="size-3.5" />
                          )}
                          <span>Save Changes</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (hasUnsavedChanges && !confirm("Discard unsaved changes?")) return
                            setIsEditMode(false)
                          }}
                          className="h-8 rounded-full border-frost text-xs"
                        >
                          Done
                        </Button>
                      </div>
                    </div>

                    {/* Metadata Edit Fields */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">List Name</label>
                        <Input
                          type="text"
                          value={editName}
                          onChange={(e) => {
                            setEditName(e.target.value)
                            setHasUnsavedChanges(true)
                          }}
                          className="h-8.5 rounded-xl text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-foreground">Private Playlist</span>
                          <p className="text-[10px] text-muted-foreground">Only you & collaborators can view</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={editIsPrivate}
                          onChange={(e) => {
                            setEditIsPrivate(e.target.checked)
                            setHasUnsavedChanges(true)
                          }}
                          className="size-4 cursor-pointer rounded accent-primary"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">Description</label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => {
                            setEditDescription(e.target.value)
                            setHasUnsavedChanges(true)
                          }}
                          className="w-full rounded-xl border border-input bg-transparent p-2.5 text-xs focus:outline-none"
                          placeholder="Collection description..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                {entriesLoading ? (
                  <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                    <IconLoader2 className="size-6 animate-spin text-primary" />
                    <span className="text-sm">Loading entries...</span>
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-frost bg-frost/50 p-12 text-center backdrop-blur-xl shadow-xl">
                    <div className="flex size-14 items-center justify-center rounded-2xl border border-frost bg-muted/50 text-muted-foreground">
                      <IconListDetails className="size-7 opacity-40" />
                    </div>
                    <h3 className="mt-4 font-heading text-base font-semibold text-foreground">
                      {entrySearchQuery ? `No entries matching "${entrySearchQuery}"` : "This custom list is empty"}
                    </h3>
                    <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                      {entrySearchQuery
                        ? "Try clearing your search query or filters."
                        : "Open any media card hovercard and use the Custom Lists tab to add items."}
                    </p>
                  </div>
                ) : isEditMode ? (
                  /* Edit Mode Interactive Reordering List */
                  <div className="space-y-2.5">
                    {filteredEntries.map((item, idx) => {
                      const media = item.media
                      const title =
                        media?.titlePrimary ||
                        media?.titleEnglish ||
                        media?.titleRomaji ||
                        "Untitled"
                      const cover = media?.coverImage || media?.images?.coverMedium || null

                      return (
                        <div
                          key={item.entry.id}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-2xl border border-frost bg-card/60 p-3 backdrop-blur-md transition-all",
                            draggedIdx === idx ? "opacity-40 border-primary" : "hover:border-border"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                              <IconGripVertical className="size-5" />
                            </div>

                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-mono font-bold text-foreground">
                              #{idx + 1}
                            </span>

                            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                              {cover ? (
                                <Image
                                  src={cover}
                                  alt={title}
                                  fill
                                  className="object-cover"
                                  sizes="48px"
                                />
                              ) : (
                                <div className="flex size-full items-center justify-center text-muted-foreground">
                                  <IconListDetails className="size-5" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-xs font-bold text-foreground">
                                  {title}
                                </span>
                                <Badge variant="outline" className="text-[10px] uppercase font-mono py-0">
                                  {item.entry.mediaType}
                                </Badge>
                              </div>
                              {item.entry.customNotes && (
                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground italic">
                                  "{item.entry.customNotes}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleMoveEntry(idx, "up")}
                              isDisabled={idx === 0}
                              className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <IconChevronUp className="size-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleMoveEntry(idx, "down")}
                              isDisabled={idx === filteredEntries.length - 1}
                              className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <IconChevronDown className="size-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleRemoveEntry(item)}
                              className="size-7 rounded-lg text-destructive hover:bg-destructive/10 ms-1"
                            >
                              <IconTrash className="size-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* Normal Mode: BorealisCardGroup Grid matching Reference Images */
                  <BorealisCardGroup
                    grid
                    variant="none"
                    gap="md"
                    className="w-full"
                  >
                    {filteredEntries.map((item, idx) => (
                      <BorealisCard
                        key={item.entry.id}
                        type={item.entry.mediaType.toLowerCase() as any}
                        data={item}
                        showSubtitle={false}
                        showHoverSubtitle={false}
                        showTabNav={true}
                        showExtras={true}
                        showBadges={true}
                        statusIconOnly={true}
                        size="md"
                        canEdit={canEditList}
                        priority={idx < 8}
                        className="w-full"
                      />
                    ))}
                  </BorealisCardGroup>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 2: COMMENTS ON CUSTOM LIST                                   */}
            {/* ================================================================ */}
            {activeTab === "comments" && (
              <div className="max-w-3xl space-y-6">
                <form onSubmit={handlePostComment} className="rounded-2xl border border-frost bg-frost p-4 backdrop-blur-2xl">
                  <label className="text-xs font-semibold text-foreground">
                    Leave a comment on "{selectedList.name}"
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Share your thoughts about this collection..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-frost bg-card/60 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />

                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={newCommentSpoiler}
                        onChange={(e) => setNewCommentSpoiler(e.target.checked)}
                        className="rounded accent-primary"
                      />
                      <span>Mark as spoiler</span>
                    </label>

                    <Button
                      type="submit"
                      size="sm"
                      isDisabled={!newCommentText.trim() || submittingComment}
                      className="rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {submittingComment ? (
                        <IconLoader2 className="size-3.5 animate-spin" />
                      ) : (
                        "Post Comment"
                      )}
                    </Button>
                  </div>
                </form>

                {commentsLoading ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <IconLoader2 className="size-6 animate-spin text-primary" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="rounded-2xl border border-frost bg-frost/40 p-8 text-center text-muted-foreground">
                    <IconMessageCircle className="mx-auto size-8 opacity-40" />
                    <p className="mt-2 text-xs">No comments yet. Start the conversation!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map((comment) => {
                      const canDelete =
                        comment.authorId === session?.user?.id || isListOwner

                      return (
                        <div
                          key={comment.id}
                          className="rounded-2xl border border-frost bg-frost/60 p-4 backdrop-blur-xl"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="relative size-8 overflow-hidden rounded-full border border-border bg-muted">
                                {comment.author?.avatarUrl ? (
                                  <Image
                                    src={comment.author.avatarUrl}
                                    alt={comment.author.username}
                                    fill
                                    className="object-cover"
                                    sizes="32px"
                                  />
                                ) : (
                                  <div className="flex size-full items-center justify-center font-bold text-xs text-muted-foreground">
                                    {comment.author?.username?.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>

                              <div>
                                <span className="text-xs font-bold text-foreground">
                                  {comment.author?.displayName || comment.author?.username}
                                </span>
                                <span className="ms-1.5 text-[10px] text-muted-foreground">
                                  @{comment.author?.username}
                                </span>
                              </div>
                            </div>

                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleDeleteComment(comment.id)}
                                className="size-7 rounded-lg text-muted-foreground hover:text-destructive"
                              >
                                <IconTrash className="size-3.5" />
                              </Button>
                            )}
                          </div>

                          <p
                            className={cn(
                              "mt-2 text-xs leading-relaxed text-foreground",
                              comment.isSpoiler && "blur-xs hover:blur-none transition-all cursor-pointer"
                            )}
                          >
                            {comment.content}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 3: STATS (EXACT COMBINED DESIGN FROM OTHER LISTS)            */}
            {/* ================================================================ */}
            {activeTab === "stats" && (
              <div className="space-y-6">
                {!customListStats ? (
                  <div className="rounded-2xl border border-frost bg-frost/40 p-12 text-center text-muted-foreground">
                    <IconChartBar className="mx-auto size-10 opacity-30" />
                    <p className="mt-3 text-sm font-semibold">No Statistics Yet</p>
                    <p className="mt-1 text-xs">Add media items to this list to see rich analytics.</p>
                  </div>
                ) : (
                  <>
                    {/* 1. Overview KPI Cards */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                      <Card className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Total Titles
                          </span>
                          <IconStack2 className="size-4 shrink-0 text-primary" />
                        </div>
                        <div className="mt-3">
                          <span className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {customListStats.overview.totalTitles}
                          </span>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            In this playlist
                          </p>
                        </div>
                      </Card>

                      <Card className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Time Spent
                          </span>
                          <IconClock className="size-4 shrink-0 text-primary" />
                        </div>
                        <div className="mt-3">
                          <span className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {customListStats.overview.daysConsumed}d
                          </span>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {Math.round(customListStats.overview.daysConsumed * 24)}h estimated
                          </p>
                        </div>
                      </Card>

                      <Card className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Mean Score
                          </span>
                          <IconStar className="size-4 shrink-0 text-primary" />
                        </div>
                        <div className="mt-3">
                          <span className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {customListStats.overview.meanScore > 0
                              ? `${customListStats.overview.meanScore.toFixed(1)}/10`
                              : "—"}
                          </span>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {customListStats.overview.scoredCount} scored
                          </p>
                        </div>
                      </Card>

                      <Card className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Std Deviation
                          </span>
                          <IconChartDots className="size-4 shrink-0 text-primary" />
                        </div>
                        <div className="mt-3">
                          <span className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {customListStats.overview.standardDeviation > 0
                              ? `±${customListStats.overview.standardDeviation.toFixed(2)}`
                              : "—"}
                          </span>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            Score variance
                          </p>
                        </div>
                      </Card>

                      <Card className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Rated Coverage
                          </span>
                          <IconCheck className="size-4 shrink-0 text-primary" />
                        </div>
                        <div className="mt-3">
                          <span className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {Math.round(
                              (customListStats.overview.scoredCount /
                                customListStats.overview.totalTitles) *
                                100
                            )}%
                          </span>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {customListStats.overview.scoredCount} of {customListStats.overview.totalTitles} rated
                          </p>
                        </div>
                      </Card>

                      <Card className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-md">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Media Types
                          </span>
                          <IconCalendarEvent className="size-4 shrink-0 text-primary" />
                        </div>
                        <div className="mt-3">
                          <span className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                            {customListStats.mediaBreakdown.length}
                          </span>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            Mixed formats
                          </p>
                        </div>
                      </Card>
                    </div>

                    {/* 2. Media Types Breakdown Grid */}
                    {customListStats.mediaBreakdown.length > 0 && (
                      <Card className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-md">
                        <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Media Breakdown
                        </h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                          {customListStats.mediaBreakdown.map((mb) => {
                            const IconComp = MEDIA_ICONS[mb.mediaType.toUpperCase()] || IconListDetails
                            return (
                              <div
                                key={mb.mediaType}
                                className="flex flex-col justify-between rounded-xl border border-border/40 bg-muted/20 p-3.5"
                              >
                                <div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <IconComp className="size-4 text-primary" />
                                      <span className="text-xs font-bold uppercase text-foreground">
                                        {mb.mediaType}
                                      </span>
                                    </div>
                                    <span className="font-mono text-xs font-bold text-foreground">
                                      {mb.count}
                                    </span>
                                  </div>
                                  <Progress
                                    value={mb.percentage}
                                    className="my-2.5 h-1.5"
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {mb.percentage}% of playlist
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    )}

                    {/* 3. Charts: Score Distribution & Year Timeline */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <ScoreDistributionChart
                        scores={customListStats.scoreDistribution.scores}
                        unratedCount={customListStats.scoreDistribution.unratedCount}
                        meanScore={customListStats.overview.meanScore}
                      />
                      <YearTimelineChart
                        releaseYears={customListStats.releaseYearGraph}
                        activityYears={[]}
                        mediaType="anime"
                      />
                    </div>

                    {/* 4. Top Genres & Studios/Creators */}
                    <GenreStudioBreakdown
                      genres={customListStats.topGenres}
                      creators={customListStats.topCreators}
                      mediaType="anime"
                    />

                    {/* 5. Format & Status Distribution */}
                    <FormatCountryDistribution
                      formats={customListStats.formatDistribution}
                      countries={[]}
                      statuses={customListStats.statusDistribution}
                    />
                  </>
                )}
              </div>
            )}

            {/* ================================================================ */}
            {/* TAB 4: ACTIVITY (CHRONOLOGICAL STREAM)                           */}
            {/* ================================================================ */}
            {activeTab === "activity" && (
              <div className="max-w-2xl space-y-3">
                {activityLoading ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <IconLoader2 className="size-6 animate-spin text-primary" />
                  </div>
                ) : activity.length === 0 ? (
                  <div className="rounded-2xl border border-frost bg-frost/40 p-8 text-center text-muted-foreground">
                    <IconClockHour4 className="mx-auto size-8 opacity-40" />
                    <p className="mt-2 text-xs">No recorded activity yet for this list.</p>
                  </div>
                ) : (
                  <div className="relative border-s border-frost ps-5 ms-3 space-y-5">
                    {activity.map((act) => (
                      <div key={act.id} className="relative flex items-start gap-3">
                        {/* Timeline dot */}
                        <span className="absolute -start-[27px] top-1.5 size-3 rounded-full bg-primary ring-4 ring-background" />

                        {/* User Avatar */}
                        <div className="relative size-7 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                          {act.user?.avatarUrl ? (
                            <Image
                              src={act.user.avatarUrl}
                              alt={act.user.username}
                              fill
                              className="object-cover"
                              sizes="28px"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {act.user?.username?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground">
                            <span className="font-bold">
                              {act.user?.displayName || act.user?.username}
                            </span>{" "}
                            {act.metadata?.action === "COLLABORATOR_ADDED" ? (
                              <>
                                invited <span className="text-primary font-medium">@{act.metadata.targetUsername}</span> as {act.metadata.role}
                              </>
                            ) : act.metadata?.action === "ENTRY_ADDED" ? (
                              <>added an item to the list</>
                            ) : act.metadata?.action === "ENTRY_REMOVED" ? (
                              <>removed an item from the list</>
                            ) : act.metadata?.action === "REORDER_ENTRIES" || act.metadata?.action === "REORDERED_ENTRIES" ? (
                              <>reordered entries</>
                            ) : act.content ? (
                              act.content
                            ) : (
                              "updated the list"
                            )}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(act.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL 1: CREATE CUSTOM LIST DIALOG                                   */}
      {/* ==================================================================== */}
      <Dialog isOpen={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <form onSubmit={handleCreateList} className="space-y-4 py-2">
          <DialogHeader>
            <DialogTitle>Create Custom List</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">List Name</label>
            <Input
              type="text"
              placeholder="e.g. Masterpieces, Weekend Marathon, Cyberpunk Vibes"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              maxLength={100}
              required
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="A brief note about this collection..."
              value={newListDescription}
              onChange={(e) => setNewListDescription(e.target.value)}
              className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <IconLock className="size-3.5 text-muted-foreground" />
                <span>Private List</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Only you and invited collaborators will be able to see this list.
              </p>
            </div>
            <input
              type="checkbox"
              checked={newListIsPrivate}
              onChange={(e) => setNewListIsPrivate(e.target.checked)}
              className="size-4 cursor-pointer rounded accent-primary"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isDisabled={!newListName.trim() || creating}
              className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {creating ? <IconLoader2 className="size-4 animate-spin" /> : "Create List"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* ==================================================================== */}
      {/* MODAL 2: COLLABORATORS MANAGEMENT DIALOG                             */}
      {/* ==================================================================== */}
      <Dialog isOpen={collaboratorsDialogOpen} onOpenChange={setCollaboratorsDialogOpen}>
        <div className="space-y-5 py-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconUsers className="size-5 text-primary" />
              <span>List Collaborators</span>
            </DialogTitle>
          </DialogHeader>

          {/* Add Collaborator Form */}
          <form onSubmit={handleAddCollaborator} className="space-y-3 rounded-xl border border-frost bg-card/60 p-3.5">
            <h4 className="text-xs font-semibold text-foreground">Invite Collaborator</h4>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search by username..."
                value={collabSearchUsername}
                onChange={(e) => setCollabSearchUsername(e.target.value)}
                required
                className="h-8.5 rounded-xl text-xs flex-1"
              />

              <select
                value={collabRole}
                onChange={(e) => setCollabRole(e.target.value as any)}
                className="h-8.5 rounded-xl border border-frost bg-card px-2.5 text-xs text-foreground"
              >
                <option value="EDITOR">Editor (Can edit)</option>
                <option value="VIEWER">Viewer (View only)</option>
              </select>

              <Button
                type="submit"
                size="sm"
                isDisabled={!collabSearchUsername.trim() || invitingCollab}
                className="h-8.5 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {invitingCollab ? (
                  <IconLoader2 className="size-3.5 animate-spin" />
                ) : (
                  <IconUserPlus className="size-3.5" />
                )}
                <span>Invite</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Editors can add, remove, and reorder items in this list. Viewers can see private lists.
            </p>
          </form>

          {/* Existing Collaborators List with Role Selector */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground">Current Collaborators</h4>
            {collaboratorsLoading ? (
              <div className="flex h-24 items-center justify-center text-muted-foreground">
                <IconLoader2 className="size-5 animate-spin text-primary" />
              </div>
            ) : collaborators.length === 0 ? (
              <p className="rounded-xl border border-frost bg-card/30 p-4 text-center text-xs text-muted-foreground">
                No collaborators invited yet.
              </p>
            ) : (
              <div className="space-y-2">
                {collaborators.map((collab) => (
                  <div
                    key={collab.id}
                    className="flex items-center justify-between rounded-xl border border-frost bg-card/50 p-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative size-8 overflow-hidden rounded-full border border-border bg-muted">
                        {collab.user?.avatarUrl ? (
                          <Image
                            src={collab.user.avatarUrl}
                            alt={collab.user.username}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-xs font-bold text-muted-foreground">
                            {collab.user?.username?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {collab.user?.displayName || collab.user?.username}
                        </p>
                        <p className="text-[10px] text-muted-foreground">@{collab.user?.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Owner can change role directly */}
                      <select
                        value={collab.role}
                        onChange={(e) =>
                          handleUpdateCollaboratorRole(collab.id, e.target.value as any)
                        }
                        className="h-7 rounded-lg border border-frost bg-card px-2 text-[11px] font-semibold text-foreground"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>

                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleRemoveCollaborator(collab.id, collab.user.username)}
                        className="size-7 rounded-lg text-muted-foreground hover:text-destructive"
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCollaboratorsDialogOpen(false)}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </div>
  )
}
