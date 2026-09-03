"use client"

import React, { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@workspace/ui/components/dropdown-menu"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import {
  IconBell,
  IconLock,
  IconLockOpen,
  IconCheck,
  IconChecks,
  IconTrash,
  IconSearch,
  IconX,
  IconChevronDown,
  IconArrowRight,
  IconSend,
  IconSquare,
  IconSquareCheck,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"
import { formatBadgeNumber } from "@/lib/numbers"
import {
  useNotifications,
  type NotificationType,
  type NotificationPriority,
} from "@/context/notification-context"
import { useEncryption } from "@/context/encryption-context"

export interface IrisNotificationsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IrisNotificationsModal({
  open,
  onOpenChange,
}: IrisNotificationsModalProps): React.JSX.Element {
  const t = useTranslations("navigation.notifications")
  const {
    notifications,
    filteredNotifications,
    unreadCount,
    filters,
    updateFilter,
    toggleFilterItem,
    resetFilters,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    submitAction,
  } = useNotifications()

  const { isActive, unlockVault } = useEncryption()

  // Local state
  const [unlockPassword, setUnlockPassword] = useState("")
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  // Action form state per notification item
  const [actionFormState, setActionFormState] = useState<
    Record<
      string,
      {
        inputs?: Record<string, string>
        select?: string
        multiSelect?: string[]
        isSubmitting?: boolean
      }
    >
  >({})

  const hasActiveFilters = useMemo(() => {
    return (
      filters.apps.length > 0 ||
      filters.types.length > 0 ||
      filters.priorities.length > 0 ||
      filters.dateRange !== "all" ||
      filters.isRead !== "all" ||
      filters.search.trim() !== ""
    )
  }, [filters])

  const handleUnlockInline = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unlockPassword) return

    setIsUnlocking(true)
    setUnlockError(null)
    const result = await unlockVault(unlockPassword)
    setIsUnlocking(false)

    if (result.success) {
      setUnlockPassword("")
    } else {
      setUnlockError(result.error || "Incorrect password")
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    try {
      const time = new Date(dateStr).getTime()
      const diffMs = Date.now() - time
      const mins = Math.floor(diffMs / 60000)
      if (mins < 1) return t("justNow")
      if (mins < 60) return t("minutesAgo", { count: mins })
      const hours = Math.floor(mins / 60)
      if (hours < 24) return t("hoursAgo", { count: hours })
      const days = Math.floor(hours / 24)
      if (days < 7) return t("daysAgo", { count: days })
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return dateStr
    }
  }

  const getTypeLabel = (type: NotificationType) => {
    switch (type) {
      case "INFO":
        return t("typeInfo")
      case "ACTION_CONFIRM":
        return t("typeActionConfirm")
      case "ACTION_INPUT":
        return t("typeActionInput")
      case "ACTION_SELECT":
        return t("typeActionSelect")
    }
  }

  const getAppLabel = (appVal: string) => {
    if (appVal.toLowerCase() === "system") return t("appSystem")
    return appVal
  }

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case "URGENT":
        return (
          <Badge
            variant="destructive"
            className="h-4 px-2 py-0.5 text-[10px] font-bold"
          >
            {t("urgent")}
          </Badge>
        )
      case "HIGH":
        return (
          <Badge
            variant="outline"
            className="h-4 border-primary/50 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
          >
            {t("high")}
          </Badge>
        )
      case "NORMAL":
        return (
          <Badge
            variant="secondary"
            className="h-4 border border-border/40 bg-secondary/80 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
          >
            {t("normal")}
          </Badge>
        )
      case "LOW":
      default:
        return (
          <Badge
            variant="outline"
            className="h-4 border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] font-normal text-muted-foreground"
          >
            {t("low")}
          </Badge>
        )
    }
  }

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      showCloseButton={false}
      className="inset-0 top-0 left-0 h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border border-border bg-background p-0 sm:fixed sm:inset-auto sm:start-1/2 sm:top-1/2 sm:h-[90vh] sm:max-h-[90vh] sm:w-[85vw] sm:max-w-[85vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:min-h-0 [&>[data-slot=dialog]]:flex-col [&>[data-slot=dialog]]:overflow-hidden"
    >
      <DialogTitle className="sr-only">{t("title")}</DialogTitle>
      <DialogDescription className="sr-only">
        {t("postQuantumEncrypted")}
      </DialogDescription>

      {/* Main Container */}
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
        {/* ========================================================================= */}
        {/* 1. HEADER BAR                                                            */}
        {/* ========================================================================= */}
        <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-card/60 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <IconBell className="size-5" />
            </div>
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                {t("title")}
              </h2>
              {unreadCount > 0 && (
                <Badge
                  variant="default"
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                >
                  {formatBadgeNumber(unreadCount, 2)} {t("unread")}
                </Badge>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => markAllAsRead()}
                className="h-8 cursor-pointer gap-1.5 rounded-xl px-2.5 text-xs text-muted-foreground hover:text-foreground"
                aria-label={t("markAllRead")}
              >
                <IconChecks className="size-4 text-primary" />
                <span className="hidden md:inline">{t("markAllRead")}</span>
              </Button>
            )}

            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => deleteAllNotifications()}
                className="h-8 cursor-pointer gap-1.5 rounded-xl px-2.5 text-xs text-muted-foreground hover:text-destructive"
                aria-label={t("clearAll")}
              >
                <IconTrash className="size-4" />
                <span className="hidden md:inline">{t("clearAll")}</span>
              </Button>
            )}

            <div className="mx-0.5 h-4 w-px bg-border/60" />

            <Button
              variant="ghost"
              size="icon-sm"
              onPress={() => onOpenChange(false)}
              className="size-8 shrink-0 cursor-pointer rounded-xl text-muted-foreground hover:text-foreground"
              aria-label={t("close")}
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. SEARCH & MULTI-SELECT FILTER TOOLBAR                                  */}
        {/* ========================================================================= */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-border/50 bg-card/30 px-4 py-3 sm:px-6">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <IconSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-8 rounded-xl border-border/80 bg-background/80 pr-8 pl-9 text-xs"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => updateFilter("search", "")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns Row */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5">
              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={resetFilters}
                  className="h-8 shrink-0 cursor-pointer rounded-xl px-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <IconX className="mr-1 size-3.5" />
                  {t("resetFilters")}
                </Button>
              )}

              {/* 1. App Multi-Select Filter */}
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 cursor-pointer gap-1.5 rounded-xl border-border/80 px-2.5 text-xs font-medium",
                    filters.apps.length > 0 &&
                      "border-primary/40 bg-primary/10 font-semibold text-primary"
                  )}
                >
                  <span>
                    {filters.apps.length === 0
                      ? t("allApps")
                      : filters.apps.length === 1
                        ? getAppLabel(filters.apps[0]!)
                        : t("appsCount", { count: filters.apps.length })}
                  </span>
                  <IconChevronDown className="size-3.5 opacity-60" />
                </Button>
                <DropdownMenu placement="bottom start" className="min-w-48 p-1">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onAction={() => updateFilter("apps", [])}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                        filters.apps.length === 0 &&
                          "font-semibold text-primary"
                      )}
                    >
                      <span>{t("allApps")}</span>
                      {filters.apps.length === 0 && (
                        <IconCheck className="size-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                    {["IRIS Account", "IRIS List", "System"].map((appVal) => {
                      const isSelected = filters.apps.includes(appVal)
                      return (
                        <DropdownMenuItem
                          key={appVal}
                          onAction={() => toggleFilterItem("apps", appVal)}
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                            isSelected &&
                              "bg-primary/15 font-semibold text-primary"
                          )}
                        >
                          <span>{getAppLabel(appVal)}</span>
                          {isSelected ? (
                            <IconSquareCheck className="size-4 text-primary" />
                          ) : (
                            <IconSquare className="size-4 text-muted-foreground/40" />
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuGroup>
                </DropdownMenu>
              </DropdownMenuTrigger>

              {/* 2. Type Multi-Select Filter */}
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 cursor-pointer gap-1.5 rounded-xl border-border/80 px-2.5 text-xs font-medium",
                    filters.types.length > 0 &&
                      "border-primary/40 bg-primary/10 font-semibold text-primary"
                  )}
                >
                  <span>
                    {filters.types.length === 0
                      ? t("allTypes")
                      : filters.types.length === 1
                        ? getTypeLabel(filters.types[0] as NotificationType)
                        : t("typesCount", { count: filters.types.length })}
                  </span>
                  <IconChevronDown className="size-3.5 opacity-60" />
                </Button>
                <DropdownMenu placement="bottom start" className="min-w-48 p-1">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onAction={() => updateFilter("types", [])}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                        filters.types.length === 0 &&
                          "font-semibold text-primary"
                      )}
                    >
                      <span>{t("allTypes")}</span>
                      {filters.types.length === 0 && (
                        <IconCheck className="size-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                    {[
                      {
                        value: "INFO" as NotificationType,
                        label: t("typeInfo"),
                      },
                      {
                        value: "ACTION_CONFIRM" as NotificationType,
                        label: t("typeActionConfirm"),
                      },
                      {
                        value: "ACTION_INPUT" as NotificationType,
                        label: t("typeActionInput"),
                      },
                      {
                        value: "ACTION_SELECT" as NotificationType,
                        label: t("typeActionSelect"),
                      },
                    ].map((typeItem) => {
                      const isSelected = filters.types.includes(typeItem.value)
                      return (
                        <DropdownMenuItem
                          key={typeItem.value}
                          onAction={() =>
                            toggleFilterItem("types", typeItem.value)
                          }
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                            isSelected &&
                              "bg-primary/15 font-semibold text-primary"
                          )}
                        >
                          <span>{typeItem.label}</span>
                          {isSelected ? (
                            <IconSquareCheck className="size-4 text-primary" />
                          ) : (
                            <IconSquare className="size-4 text-muted-foreground/40" />
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuGroup>
                </DropdownMenu>
              </DropdownMenuTrigger>

              {/* 3. Priority Multi-Select Filter */}
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 cursor-pointer gap-1.5 rounded-xl border-border/80 px-2.5 text-xs font-medium",
                    filters.priorities.length > 0 &&
                      "border-primary/40 bg-primary/10 font-semibold text-primary"
                  )}
                >
                  <span>
                    {filters.priorities.length === 0
                      ? t("allPriorities")
                      : filters.priorities.length === 1
                        ? ({
                            URGENT: t("urgent"),
                            HIGH: t("high"),
                            NORMAL: t("normal"),
                            LOW: t("low"),
                          }[filters.priorities[0] as NotificationPriority] ??
                          t("allPriorities"))
                        : t("prioritiesCount", {
                            count: filters.priorities.length,
                          })}
                  </span>
                  <IconChevronDown className="size-3.5 opacity-60" />
                </Button>
                <DropdownMenu placement="bottom start" className="min-w-44 p-1">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onAction={() => updateFilter("priorities", [])}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                        filters.priorities.length === 0 &&
                          "font-semibold text-primary"
                      )}
                    >
                      <span>{t("allPriorities")}</span>
                      {filters.priorities.length === 0 && (
                        <IconCheck className="size-3.5 text-primary" />
                      )}
                    </DropdownMenuItem>
                    {[
                      {
                        value: "URGENT" as NotificationPriority,
                        label: t("urgent"),
                      },
                      {
                        value: "HIGH" as NotificationPriority,
                        label: t("high"),
                      },
                      {
                        value: "NORMAL" as NotificationPriority,
                        label: t("normal"),
                      },
                      { value: "LOW" as NotificationPriority, label: t("low") },
                    ].map((pItem) => {
                      const isSelected = filters.priorities.includes(
                        pItem.value
                      )
                      return (
                        <DropdownMenuItem
                          key={pItem.value}
                          onAction={() =>
                            toggleFilterItem("priorities", pItem.value)
                          }
                          className={cn(
                            "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                            isSelected &&
                              "bg-primary/15 font-semibold text-primary"
                          )}
                        >
                          <span>{pItem.label}</span>
                          {isSelected ? (
                            <IconSquareCheck className="size-4 text-primary" />
                          ) : (
                            <IconSquare className="size-4 text-muted-foreground/40" />
                          )}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuGroup>
                </DropdownMenu>
              </DropdownMenuTrigger>

              {/* 4. Date Filter */}
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 cursor-pointer gap-1.5 rounded-xl border-border/80 px-2.5 text-xs font-medium",
                    filters.dateRange !== "all" &&
                      "border-primary/40 bg-primary/10 font-semibold text-primary"
                  )}
                >
                  <span>
                    {filters.dateRange === "all"
                      ? t("allDates")
                      : filters.dateRange === "today"
                        ? t("today")
                        : t("week")}
                  </span>
                  <IconChevronDown className="size-3.5 opacity-60" />
                </Button>
                <DropdownMenu placement="bottom start" className="min-w-36 p-1">
                  <DropdownMenuGroup>
                    {[
                      { value: "all", label: t("allDates") },
                      { value: "today", label: t("today") },
                      { value: "week", label: t("week") },
                    ].map((dItem) => (
                      <DropdownMenuItem
                        key={dItem.value}
                        onAction={() =>
                          updateFilter("dateRange", dItem.value as any)
                        }
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                          filters.dateRange === dItem.value &&
                            "bg-primary/15 font-semibold text-primary"
                        )}
                      >
                        <span>{dItem.label}</span>
                        {filters.dateRange === dItem.value && (
                          <IconCheck className="size-3.5 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenu>
              </DropdownMenuTrigger>

              {/* 5. Read Filter */}
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 cursor-pointer gap-1.5 rounded-xl border-border/80 px-2.5 text-xs font-medium",
                    filters.isRead !== "all" &&
                      "border-primary/40 bg-primary/10 font-semibold text-primary"
                  )}
                >
                  <span>
                    {filters.isRead === "all"
                      ? t("allRead")
                      : filters.isRead === "unread"
                        ? t("unreadOnly")
                        : t("readOnly")}
                  </span>
                  <IconChevronDown className="size-3.5 opacity-60" />
                </Button>
                <DropdownMenu placement="bottom start" className="min-w-36 p-1">
                  <DropdownMenuGroup>
                    {[
                      { value: "all", label: t("allRead") },
                      { value: "unread", label: t("unreadOnly") },
                      { value: "read", label: t("readOnly") },
                    ].map((rItem) => (
                      <DropdownMenuItem
                        key={rItem.value}
                        onAction={() =>
                          updateFilter("isRead", rItem.value as any)
                        }
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs",
                          filters.isRead === rItem.value &&
                            "bg-primary/15 font-semibold text-primary"
                        )}
                      >
                        <span>{rItem.label}</span>
                        {filters.isRead === rItem.value && (
                          <IconCheck className="size-3.5 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenu>
              </DropdownMenuTrigger>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. LOCKED VAULT INLINE DECRYPTION BANNER                                  */}
        {/* ========================================================================= */}
        {!isActive && (
          <div className="mx-4 mt-4 flex shrink-0 flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 sm:mx-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <IconLock className="size-4.5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-foreground">
                  {t("lockedBannerTitle")}
                </h4>
                <p className="max-w-xl text-[11px] text-muted-foreground">
                  {t("lockedBannerDesc")}
                </p>
                {unlockError && (
                  <p className="text-[11px] font-medium text-destructive">
                    {unlockError}
                  </p>
                )}
              </div>
            </div>

            <form
              onSubmit={handleUnlockInline}
              className="flex w-full items-center gap-2 sm:w-auto"
            >
              <Input
                type="password"
                placeholder={t("unlockPlaceholder")}
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="h-8 min-w-48 rounded-xl border-border bg-background text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isUnlocking || !unlockPassword}
                className="h-8 shrink-0 cursor-pointer gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
              >
                <IconLockOpen className="size-3.5" />
                {isUnlocking ? "..." : t("unlockButton")}
              </Button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. NOTIFICATIONS LIST VIEW                                                */}
        {/* ========================================================================= */}
        <main className="no-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {filteredNotifications.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center space-y-3 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-3xl border border-border/60 bg-card text-muted-foreground/60 shadow-inner">
                <IconBell className="size-7" />
              </div>
              <div className="max-w-sm space-y-1">
                <h3 className="text-sm font-bold text-foreground">
                  {t("noNotifications")}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("noNotificationsDesc")}
                </p>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={resetFilters}
                  className="mt-2 rounded-xl text-xs"
                >
                  {t("resetFilters")}
                </Button>
              )}
            </div>
          ) : (
            /* Notifications Cards */
            filteredNotifications.map((item) => {
              const form = actionFormState[item.id] || {}
              const isPending = item.actionStatus === "PENDING"
              const isMulti = Boolean(item.content?.actionSelect?.isMultiSelect)
              const selectedMulti = form.multiSelect || []

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative rounded-2xl border p-4 transition-all duration-150 sm:p-5",
                    item.isRead
                      ? "border-border/40 bg-card/40 hover:border-border/80"
                      : "border-primary/40 bg-card shadow-xs ring-1 ring-primary/20 hover:border-primary/60",
                    item.priority === "URGENT" &&
                      !item.isRead &&
                      "border-destructive/50 bg-destructive/5 ring-1 ring-destructive/20 hover:border-destructive/70"
                  )}
                >
                  {/* Card Header: Meta + Priority + Actions */}
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-lg bg-background/80 px-2 py-0.5 text-[10px] font-semibold"
                      >
                        {getAppLabel(item.app)}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="rounded-lg px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {item.category}
                      </Badge>
                      {getPriorityBadge(item.priority)}
                      <span className="font-mono text-[11px] text-muted-foreground/75">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    {/* Quick Card Controls */}
                    <div className="flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                      {!item.isRead && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onPress={() => markAsRead(item.id)}
                          className="size-7 cursor-pointer rounded-lg text-muted-foreground hover:text-primary"
                          aria-label={t("markAllRead")}
                        >
                          <IconCheck className="size-3.5 text-primary" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onPress={() => deleteNotification(item.id)}
                        className="size-7 cursor-pointer rounded-lg text-muted-foreground hover:text-destructive"
                        aria-label={t("clearAll")}
                      >
                        <IconTrash className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Card Content (Decrypted or Encrypted Placeholder) */}
                  {item.isDecrypted && item.content ? (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm leading-snug font-bold text-foreground">
                          {item.content.title}
                        </h4>
                        <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                          {item.content.body}
                        </p>
                      </div>

                      {/* 1. Type ACTION_CONFIRM */}
                      {item.type === "ACTION_CONFIRM" && (
                        <div className="pt-1">
                          {isPending ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant={
                                  item.content.actionConfirm?.confirmVariant ||
                                  "default"
                                }
                                disabled={form.isSubmitting}
                                onPress={async () => {
                                  setActionFormState((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      isSubmitting: true,
                                    },
                                  }))
                                  await submitAction(item.id, "CONFIRM")
                                }}
                                className="h-8 cursor-pointer rounded-xl px-3 text-xs"
                              >
                                <IconCheck className="mr-1 size-3.5" />
                                {item.content.actionConfirm?.confirmLabel ||
                                  t("confirm")}
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  item.content.actionConfirm?.rejectVariant ||
                                  "outline"
                                }
                                disabled={form.isSubmitting}
                                onPress={async () => {
                                  setActionFormState((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      isSubmitting: true,
                                    },
                                  }))
                                  await submitAction(item.id, "REJECT")
                                }}
                                className="h-8 cursor-pointer rounded-xl px-3 text-xs"
                              >
                                <IconX className="mr-1 size-3.5" />
                                {item.content.actionConfirm?.rejectLabel ||
                                  t("reject")}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  item.actionStatus === "CONFIRMED"
                                    ? "default"
                                    : "destructive"
                                }
                                className="gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold"
                              >
                                {item.actionStatus === "CONFIRMED" ? (
                                  <>
                                    <IconCheck className="size-3.5" />
                                    {t("approved")}
                                  </>
                                ) : (
                                  <>
                                    <IconX className="size-3.5" />
                                    {t("denied")}
                                  </>
                                )}
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Type ACTION_INPUT */}
                      {item.type === "ACTION_INPUT" &&
                        item.content.actionInputs && (
                          <div className="space-y-2.5 pt-1">
                            {isPending ? (
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault()
                                  setActionFormState((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      isSubmitting: true,
                                    },
                                  }))
                                  await submitAction(
                                    item.id,
                                    "SUBMIT",
                                    form.inputs || {}
                                  )
                                }}
                                className="max-w-md space-y-2"
                              >
                                {item.content.actionInputs.map((inputDef) => (
                                  <div key={inputDef.id} className="space-y-1">
                                    <label className="block text-[11px] font-semibold text-muted-foreground">
                                      {inputDef.label}{" "}
                                      {inputDef.required && (
                                        <span className="text-destructive">
                                          *
                                        </span>
                                      )}
                                    </label>
                                    <Input
                                      type={inputDef.type || "text"}
                                      placeholder={inputDef.placeholder}
                                      required={inputDef.required}
                                      value={form.inputs?.[inputDef.id] || ""}
                                      onChange={(e) => {
                                        const val = e.target.value
                                        setActionFormState((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            inputs: {
                                              ...(prev[item.id]?.inputs || {}),
                                              [inputDef.id]: val,
                                            },
                                          },
                                        }))
                                      }}
                                      className="h-8 rounded-xl bg-background/80 text-xs"
                                    />
                                  </div>
                                ))}
                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={form.isSubmitting}
                                  className="mt-1 h-8 cursor-pointer rounded-xl px-3 text-xs"
                                >
                                  <IconSend className="mr-1 size-3.5" />
                                  {t("submit")}
                                </Button>
                              </form>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="default"
                                  className="gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold"
                                >
                                  <IconCheck className="size-3.5" />
                                  {t("submitted")}
                                </Badge>
                                {item.actionPayload && (
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {JSON.stringify(item.actionPayload)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                      {/* 3. Type ACTION_SELECT (Single & Multi-Select) */}
                      {item.type === "ACTION_SELECT" &&
                        item.content.actionSelect && (
                          <div className="space-y-2.5 pt-1">
                            {isPending ? (
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault()
                                  if (isMulti) {
                                    if (selectedMulti.length === 0) return
                                    setActionFormState((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        isSubmitting: true,
                                      },
                                    }))
                                    await submitAction(item.id, "SUBMIT", {
                                      selection: selectedMulti,
                                    })
                                  } else {
                                    if (!form.select) return
                                    setActionFormState((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        ...prev[item.id],
                                        isSubmitting: true,
                                      },
                                    }))
                                    await submitAction(item.id, "SUBMIT", {
                                      selection: form.select,
                                    })
                                  }
                                }}
                                className="max-w-lg space-y-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                                    <span>
                                      {item.content.actionSelect.label}
                                    </span>
                                    {isMulti && (
                                      <Badge
                                        variant="outline"
                                        className="px-1.5 py-0 text-[9px]"
                                      >
                                        {t("multiSelectLabel", {
                                          count: selectedMulti.length,
                                        })}
                                      </Badge>
                                    )}
                                  </label>

                                  {isMulti && (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const allValues =
                                            item.content!.actionSelect!.options.map(
                                              (o) => o.value
                                            )
                                          setActionFormState((prev) => ({
                                            ...prev,
                                            [item.id]: {
                                              ...prev[item.id],
                                              multiSelect: allValues,
                                            },
                                          }))
                                        }}
                                        className="cursor-pointer text-[10px] text-primary hover:underline"
                                      >
                                        {t("selectAll")}
                                      </button>
                                      <span className="text-[10px] text-muted-foreground/40">
                                        •
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionFormState((prev) => ({
                                            ...prev,
                                            [item.id]: {
                                              ...prev[item.id],
                                              multiSelect: [],
                                            },
                                          }))
                                        }}
                                        className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground"
                                      >
                                        {t("clear")}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  {item.content.actionSelect.options.map(
                                    (opt) => {
                                      const isSelected = isMulti
                                        ? selectedMulti.includes(opt.value)
                                        : form.select === opt.value

                                      return (
                                        <button
                                          key={opt.value}
                                          type="button"
                                          onClick={() => {
                                            if (isMulti) {
                                              const next = isSelected
                                                ? selectedMulti.filter(
                                                    (v) => v !== opt.value
                                                  )
                                                : [...selectedMulti, opt.value]
                                              setActionFormState((prev) => ({
                                                ...prev,
                                                [item.id]: {
                                                  ...prev[item.id],
                                                  multiSelect: next,
                                                },
                                              }))
                                            } else {
                                              setActionFormState((prev) => ({
                                                ...prev,
                                                [item.id]: {
                                                  ...prev[item.id],
                                                  select: opt.value,
                                                },
                                              }))
                                            }
                                          }}
                                          className={cn(
                                            "flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-start text-xs transition-all",
                                            isSelected
                                              ? "border-primary bg-primary/15 font-semibold text-primary shadow-2xs"
                                              : "border-border/70 bg-background/80 text-foreground hover:border-border"
                                          )}
                                        >
                                          <div className="mt-0.5 shrink-0">
                                            {isMulti ? (
                                              isSelected ? (
                                                <IconSquareCheck className="size-4 text-primary" />
                                              ) : (
                                                <IconSquare className="size-4 text-muted-foreground/50" />
                                              )
                                            ) : isSelected ? (
                                              <div className="flex size-3.5 items-center justify-center rounded-full border-2 border-primary bg-primary">
                                                <div className="size-1.5 rounded-full bg-background" />
                                              </div>
                                            ) : (
                                              <div className="size-3.5 rounded-full border border-muted-foreground/50" />
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <span className="block truncate font-semibold">
                                              {opt.label}
                                            </span>
                                            {opt.description && (
                                              <span className="mt-0.5 line-clamp-2 block text-[10px] text-muted-foreground/80">
                                                {opt.description}
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      )
                                    }
                                  )}
                                </div>

                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={
                                    form.isSubmitting ||
                                    (isMulti
                                      ? selectedMulti.length === 0
                                      : !form.select)
                                  }
                                  className="mt-1 h-8 cursor-pointer rounded-xl px-3 text-xs"
                                >
                                  <IconCheck className="mr-1 size-3.5" />
                                  {isMulti
                                    ? t("submitSelected", {
                                        count: selectedMulti.length,
                                      })
                                    : t("submit")}
                                </Button>
                              </form>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant="default"
                                    className="gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold"
                                  >
                                    <IconCheck className="size-3.5" />
                                    {t("submitted")}
                                  </Badge>
                                </div>
                                {item.actionPayload?.selection && (
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                                    <span>{t("selectedLabel")}:</span>
                                    {Array.isArray(
                                      item.actionPayload.selection
                                    ) ? (
                                      item.actionPayload.selection.map(
                                        (val: string) => {
                                          const matched =
                                            item.content?.actionSelect?.options.find(
                                              (o) => o.value === val
                                            )
                                          return (
                                            <Badge
                                              key={val}
                                              variant="secondary"
                                              className="px-1.5 py-0 text-[10px]"
                                            >
                                              {matched?.label || val}
                                            </Badge>
                                          )
                                        }
                                      )
                                    ) : (
                                      <Badge
                                        variant="secondary"
                                        className="px-1.5 py-0 text-[10px]"
                                      >
                                        {item.content?.actionSelect?.options.find(
                                          (o) =>
                                            o.value ===
                                            item.actionPayload.selection
                                        )?.label ||
                                          String(item.actionPayload.selection)}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                      {/* 4. Type INFO with optional Link */}
                      {item.type === "INFO" && item.content.link && (
                        <div className="pt-1">
                          <a
                            href={item.content.link}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            <span>{t("openReference")}</span>
                            <IconArrowRight className="size-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Locked / Encrypted Placeholder */
                    <div className="space-y-2 py-1">
                      <div className="space-y-1.5 opacity-40 blur-[2px] select-none">
                        <div className="h-3.5 w-2/3 rounded-md bg-muted-foreground/50" />
                        <div className="h-3 w-full rounded-md bg-muted-foreground/30" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </main>

        {/* ========================================================================= */}
        {/* 5. FOOTER                                                                 */}
        {/* ========================================================================= */}
        <footer className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-card/40 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {t("notificationCount", {
                count: filteredNotifications.length,
                total: notifications.length,
              })}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onPress={() => onOpenChange(false)}
            className="cursor-pointer rounded-xl text-xs"
          >
            {t("close")}
          </Button>
        </footer>
      </div>
    </Dialog>
  )
}
