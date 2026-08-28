"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
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
} from "@tabler/icons-react";
import { cn } from "@workspace/ui/lib/utils";
import { formatBadgeNumber } from "@/lib/numbers";
import {
  useNotifications,
  type NotificationType,
  type NotificationPriority,
} from "@/context/notification-context";
import { useEncryption } from "@/context/encryption-context";

export interface IrisNotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IrisNotificationsModal({
  open,
  onOpenChange,
}: IrisNotificationsModalProps): React.JSX.Element {
  const t = useTranslations("navigation.notifications");
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
  } = useNotifications();

  const { isActive, unlockVault } = useEncryption();

  // Local state
  const [unlockPassword, setUnlockPassword] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Action form state per notification item
  const [actionFormState, setActionFormState] = useState<
    Record<string, { inputs?: Record<string, string>; select?: string; multiSelect?: string[]; isSubmitting?: boolean }>
  >({});

  const hasActiveFilters = useMemo(() => {
    return (
      filters.apps.length > 0 ||
      filters.types.length > 0 ||
      filters.priorities.length > 0 ||
      filters.dateRange !== "all" ||
      filters.isRead !== "all" ||
      filters.search.trim() !== ""
    );
  }, [filters]);

  const handleUnlockInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword) return;

    setIsUnlocking(true);
    setUnlockError(null);
    const result = await unlockVault(unlockPassword);
    setIsUnlocking(false);

    if (result.success) {
      setUnlockPassword("");
    } else {
      setUnlockError(result.error || "Incorrect password");
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const time = new Date(dateStr).getTime();
      const diffMs = Date.now() - time;
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return t("justNow");
      if (mins < 60) return t("minutesAgo", { count: mins });
      const hours = Math.floor(mins / 60);
      if (hours < 24) return t("hoursAgo", { count: hours });
      const days = Math.floor(hours / 24);
      if (days < 7) return t("daysAgo", { count: days });
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const getTypeLabel = (type: NotificationType) => {
    switch (type) {
      case "INFO":
        return t("typeInfo");
      case "ACTION_CONFIRM":
        return t("typeActionConfirm");
      case "ACTION_INPUT":
        return t("typeActionInput");
      case "ACTION_SELECT":
        return t("typeActionSelect");
    }
  };

  const getAppLabel = (appVal: string) => {
    if (appVal.toLowerCase() === "system") return t("appSystem");
    return appVal;
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case "URGENT":
        return (
          <Badge variant="destructive" className="text-[10px] px-2 py-0.5 h-4 font-bold">
            {t("urgent")}
          </Badge>
        );
      case "HIGH":
        return (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-4 font-semibold border-primary/50 text-primary bg-primary/10">
            {t("high")}
          </Badge>
        );
      case "NORMAL":
        return (
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 h-4 font-medium text-secondary-foreground bg-secondary/80 border border-border/40">
            {t("normal")}
          </Badge>
        );
      case "LOW":
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-4 font-normal text-muted-foreground border-border/50 bg-muted/30">
            {t("low")}
          </Badge>
        );
    }
  };

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      showCloseButton={false}
      className="inset-0 top-0 left-0 translate-x-0 translate-y-0 w-full h-full max-w-none max-h-none rounded-none p-0 gap-0 overflow-hidden sm:fixed sm:inset-auto sm:top-1/2 sm:start-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[85vw] sm:h-[90vh] sm:max-w-[85vw] sm:max-h-[90vh] sm:rounded-3xl [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:min-h-0 [&>[data-slot=dialog]]:overflow-hidden [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:flex-col bg-background border border-border"
    >
      <DialogTitle className="sr-only">{t("title")}</DialogTitle>
      <DialogDescription className="sr-only">
        {t("postQuantumEncrypted")}
      </DialogDescription>

      {/* Main Container */}
      <div className="flex flex-col h-full w-full min-h-0 overflow-hidden bg-background">
        
        {/* ========================================================================= */}
        {/* 1. HEADER BAR                                                            */}
        {/* ========================================================================= */}
        <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6 border-b border-border/70 bg-card/60 backdrop-blur-md z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <IconBell className="size-5" />
            </div>
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                {t("title")}
              </h2>
              {unreadCount > 0 && (
                <Badge variant="default" className="text-[11px] px-2 py-0.5 rounded-full font-bold">
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
                className="text-xs h-8 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer rounded-xl"
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
                className="text-xs h-8 px-2.5 gap-1.5 text-muted-foreground hover:text-destructive cursor-pointer rounded-xl"
                aria-label={t("clearAll")}
              >
                <IconTrash className="size-4" />
                <span className="hidden md:inline">{t("clearAll")}</span>
              </Button>
            )}

            <div className="h-4 w-px bg-border/60 mx-0.5" />

            <Button
              variant="ghost"
              size="icon-sm"
              onPress={() => onOpenChange(false)}
              className="size-8 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              aria-label={t("close")}
            >
              <IconX className="size-4" />
            </Button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. SEARCH & MULTI-SELECT FILTER TOOLBAR                                  */}
        {/* ========================================================================= */}
        <div className="px-4 sm:px-6 py-3 border-b border-border/50 bg-card/30 flex flex-col gap-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9 pr-8 h-8 text-xs rounded-xl bg-background/80 border-border/80"
              />
              {filters.search && (
                <button
                  type="button"
                  onClick={() => updateFilter("search", "")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <IconX className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={resetFilters}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-xl shrink-0"
                >
                  <IconX className="size-3.5 mr-1" />
                  {t("resetFilters")}
                </Button>
              )}

              {/* 1. App Multi-Select Filter */}
              <DropdownMenuTrigger>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 px-2.5 text-xs rounded-xl gap-1.5 font-medium cursor-pointer border-border/80",
                    filters.apps.length > 0 && "bg-primary/10 border-primary/40 text-primary font-semibold"
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
                        "text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-between",
                        filters.apps.length === 0 && "text-primary font-semibold"
                      )}
                    >
                      <span>{t("allApps")}</span>
                      {filters.apps.length === 0 && <IconCheck className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                    {["IRIS Account", "IRIS List", "System"].map((appVal) => {
                      const isSelected = filters.apps.includes(appVal);
                      return (
                        <DropdownMenuItem
                          key={appVal}
                          onAction={() => toggleFilterItem("apps", appVal)}
                          className={cn(
                            "text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-between cursor-pointer",
                            isSelected && "bg-primary/15 text-primary font-semibold"
                          )}
                        >
                          <span>{getAppLabel(appVal)}</span>
                          {isSelected ? (
                            <IconSquareCheck className="size-4 text-primary" />
                          ) : (
                            <IconSquare className="size-4 text-muted-foreground/40" />
                          )}
                        </DropdownMenuItem>
                      );
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
                    "h-8 px-2.5 text-xs rounded-xl gap-1.5 font-medium cursor-pointer border-border/80",
                    filters.types.length > 0 && "bg-primary/10 border-primary/40 text-primary font-semibold"
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
                        "text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-between",
                        filters.types.length === 0 && "text-primary font-semibold"
                      )}
                    >
                      <span>{t("allTypes")}</span>
                      {filters.types.length === 0 && <IconCheck className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                    {[
                      { value: "INFO" as NotificationType, label: t("typeInfo") },
                      { value: "ACTION_CONFIRM" as NotificationType, label: t("typeActionConfirm") },
                      { value: "ACTION_INPUT" as NotificationType, label: t("typeActionInput") },
                      { value: "ACTION_SELECT" as NotificationType, label: t("typeActionSelect") },
                    ].map((typeItem) => {
                      const isSelected = filters.types.includes(typeItem.value);
                      return (
                        <DropdownMenuItem
                          key={typeItem.value}
                          onAction={() => toggleFilterItem("types", typeItem.value)}
                          className={cn(
                            "text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-between cursor-pointer",
                            isSelected && "bg-primary/15 text-primary font-semibold"
                          )}
                        >
                          <span>{typeItem.label}</span>
                          {isSelected ? (
                            <IconSquareCheck className="size-4 text-primary" />
                          ) : (
                            <IconSquare className="size-4 text-muted-foreground/40" />
                          )}
                        </DropdownMenuItem>
                      );
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
                    "h-8 px-2.5 text-xs rounded-xl gap-1.5 font-medium cursor-pointer border-border/80",
                    filters.priorities.length > 0 && "bg-primary/10 border-primary/40 text-primary font-semibold"
                  )}
                >
                  <span>
                    {filters.priorities.length === 0
                      ? t("allPriorities")
                      : filters.priorities.length === 1
                        ? {
                            URGENT: t("urgent"),
                            HIGH: t("high"),
                            NORMAL: t("normal"),
                            LOW: t("low"),
                          }[filters.priorities[0] as NotificationPriority] ?? t("allPriorities")
                        : t("prioritiesCount", { count: filters.priorities.length })}
                  </span>
                  <IconChevronDown className="size-3.5 opacity-60" />
                </Button>
                <DropdownMenu placement="bottom start" className="min-w-44 p-1">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onAction={() => updateFilter("priorities", [])}
                      className={cn(
                        "text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-between",
                        filters.priorities.length === 0 && "text-primary font-semibold"
                      )}
                    >
                      <span>{t("allPriorities")}</span>
                      {filters.priorities.length === 0 && <IconCheck className="size-3.5 text-primary" />}
                    </DropdownMenuItem>
                    {[
                      { value: "URGENT" as NotificationPriority, label: t("urgent") },
                      { value: "HIGH" as NotificationPriority, label: t("high") },
                      { value: "NORMAL" as NotificationPriority, label: t("normal") },
                      { value: "LOW" as NotificationPriority, label: t("low") },
                    ].map((pItem) => {
                      const isSelected = filters.priorities.includes(pItem.value);
                      return (
                        <DropdownMenuItem
                          key={pItem.value}
                          onAction={() => toggleFilterItem("priorities", pItem.value)}
                          className={cn(
                            "text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-between cursor-pointer",
                            isSelected && "bg-primary/15 text-primary font-semibold"
                          )}
                        >
                          <span>{pItem.label}</span>
                          {isSelected ? (
                            <IconSquareCheck className="size-4 text-primary" />
                          ) : (
                            <IconSquare className="size-4 text-muted-foreground/40" />
                          )}
                        </DropdownMenuItem>
                      );
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
                    "h-8 px-2.5 text-xs rounded-xl gap-1.5 font-medium cursor-pointer border-border/80",
                    filters.dateRange !== "all" && "bg-primary/10 border-primary/40 text-primary font-semibold"
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
                        onAction={() => updateFilter("dateRange", dItem.value as any)}
                        className={cn("text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-between", filters.dateRange === dItem.value && "bg-primary/15 text-primary font-semibold")}
                      >
                        <span>{dItem.label}</span>
                        {filters.dateRange === dItem.value && <IconCheck className="size-3.5 text-primary" />}
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
                    "h-8 px-2.5 text-xs rounded-xl gap-1.5 font-medium cursor-pointer border-border/80",
                    filters.isRead !== "all" && "bg-primary/10 border-primary/40 text-primary font-semibold"
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
                        onAction={() => updateFilter("isRead", rItem.value as any)}
                        className={cn("text-xs py-1.5 px-2.5 rounded-lg flex items-center justify-between", filters.isRead === rItem.value && "bg-primary/15 text-primary font-semibold")}
                      >
                        <span>{rItem.label}</span>
                        {filters.isRead === rItem.value && <IconCheck className="size-3.5 text-primary" />}
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
          <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                <IconLock className="size-4.5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold text-foreground">
                  {t("lockedBannerTitle")}
                </h4>
                <p className="text-[11px] text-muted-foreground max-w-xl">
                  {t("lockedBannerDesc")}
                </p>
                {unlockError && (
                  <p className="text-[11px] text-destructive font-medium">{unlockError}</p>
                )}
              </div>
            </div>

            <form onSubmit={handleUnlockInline} className="flex items-center gap-2 w-full sm:w-auto">
              <Input
                type="password"
                placeholder={t("unlockPlaceholder")}
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                className="h-8 text-xs rounded-xl bg-background min-w-48 border-border"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isUnlocking || !unlockPassword}
                className="h-8 text-xs rounded-xl gap-1.5 px-3 bg-primary text-primary-foreground font-semibold cursor-pointer shrink-0"
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
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 no-scrollbar space-y-3">
          {filteredNotifications.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="size-14 rounded-3xl bg-card border border-border/60 flex items-center justify-center text-muted-foreground/60 shadow-inner">
                <IconBell className="size-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-bold text-foreground">{t("noNotifications")}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("noNotificationsDesc")}
                </p>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={resetFilters}
                  className="rounded-xl text-xs mt-2"
                >
                  {t("resetFilters")}
                </Button>
              )}
            </div>
          ) : (
            /* Notifications Cards */
            filteredNotifications.map((item) => {
              const form = actionFormState[item.id] || {};
              const isPending = item.actionStatus === "PENDING";
              const isMulti = Boolean(item.content?.actionSelect?.isMultiSelect);
              const selectedMulti = form.multiSelect || [];

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative p-4 sm:p-5 rounded-2xl border transition-all duration-150",
                    item.isRead
                      ? "bg-card/40 border-border/40 hover:border-border/80"
                      : "bg-card border-primary/40 ring-1 ring-primary/20 shadow-xs hover:border-primary/60",
                    item.priority === "URGENT" && !item.isRead && "bg-destructive/5 border-destructive/50 ring-1 ring-destructive/20 hover:border-destructive/70"
                  )}
                >
                  {/* Card Header: Meta + Priority + Actions */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-background/80">
                        {getAppLabel(item.app)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-lg text-muted-foreground">
                        {item.category}
                      </Badge>
                      {getPriorityBadge(item.priority)}
                      <span className="text-[11px] text-muted-foreground/75 font-mono">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>

                    {/* Quick Card Controls */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {!item.isRead && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onPress={() => markAsRead(item.id)}
                          className="size-7 rounded-lg text-muted-foreground hover:text-primary cursor-pointer"
                          aria-label={t("markAllRead")}
                        >
                          <IconCheck className="size-3.5 text-primary" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onPress={() => deleteNotification(item.id)}
                        className="size-7 rounded-lg text-muted-foreground hover:text-destructive cursor-pointer"
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
                        <h4 className="text-sm font-bold text-foreground leading-snug">
                          {item.content.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
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
                                variant={item.content.actionConfirm?.confirmVariant || "default"}
                                disabled={form.isSubmitting}
                                onPress={async () => {
                                  setActionFormState((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], isSubmitting: true },
                                  }));
                                  await submitAction(item.id, "CONFIRM");
                                }}
                                className="text-xs h-8 rounded-xl px-3 cursor-pointer"
                              >
                                <IconCheck className="size-3.5 mr-1" />
                                {item.content.actionConfirm?.confirmLabel || t("confirm")}
                              </Button>
                              <Button
                                size="sm"
                                variant={item.content.actionConfirm?.rejectVariant || "outline"}
                                disabled={form.isSubmitting}
                                onPress={async () => {
                                  setActionFormState((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], isSubmitting: true },
                                  }));
                                  await submitAction(item.id, "REJECT");
                                }}
                                className="text-xs h-8 rounded-xl px-3 cursor-pointer"
                              >
                                <IconX className="size-3.5 mr-1" />
                                {item.content.actionConfirm?.rejectLabel || t("reject")}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={item.actionStatus === "CONFIRMED" ? "default" : "destructive"}
                                className="text-xs px-2.5 py-1 rounded-xl font-semibold gap-1"
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
                      {item.type === "ACTION_INPUT" && item.content.actionInputs && (
                        <div className="pt-1 space-y-2.5">
                          {isPending ? (
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                setActionFormState((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], isSubmitting: true },
                                }));
                                await submitAction(item.id, "SUBMIT", form.inputs || {});
                              }}
                              className="space-y-2 max-w-md"
                            >
                              {item.content.actionInputs.map((inputDef) => (
                                <div key={inputDef.id} className="space-y-1">
                                  <label className="text-[11px] font-semibold text-muted-foreground block">
                                    {inputDef.label} {inputDef.required && <span className="text-destructive">*</span>}
                                  </label>
                                  <Input
                                    type={inputDef.type || "text"}
                                    placeholder={inputDef.placeholder}
                                    required={inputDef.required}
                                    value={form.inputs?.[inputDef.id] || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setActionFormState((prev) => ({
                                        ...prev,
                                        [item.id]: {
                                          ...prev[item.id],
                                          inputs: { ...(prev[item.id]?.inputs || {}), [inputDef.id]: val },
                                        },
                                      }));
                                    }}
                                    className="h-8 text-xs rounded-xl bg-background/80"
                                  />
                                </div>
                              ))}
                              <Button
                                type="submit"
                                size="sm"
                                disabled={form.isSubmitting}
                                className="text-xs h-8 rounded-xl px-3 cursor-pointer mt-1"
                              >
                                <IconSend className="size-3.5 mr-1" />
                                {t("submit")}
                              </Button>
                            </form>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="text-xs px-2.5 py-1 rounded-xl font-semibold gap-1">
                                <IconCheck className="size-3.5" />
                                {t("submitted")}
                              </Badge>
                              {item.actionPayload && (
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {JSON.stringify(item.actionPayload)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. Type ACTION_SELECT (Single & Multi-Select) */}
                      {item.type === "ACTION_SELECT" && item.content.actionSelect && (
                        <div className="pt-1 space-y-2.5">
                          {isPending ? (
                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                if (isMulti) {
                                  if (selectedMulti.length === 0) return;
                                  setActionFormState((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], isSubmitting: true },
                                  }));
                                  await submitAction(item.id, "SUBMIT", { selection: selectedMulti });
                                } else {
                                  if (!form.select) return;
                                  setActionFormState((prev) => ({
                                    ...prev,
                                    [item.id]: { ...prev[item.id], isSubmitting: true },
                                  }));
                                  await submitAction(item.id, "SUBMIT", { selection: form.select });
                                }
                              }}
                              className="space-y-2.5 max-w-lg"
                            >
                              <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                  <span>{item.content.actionSelect.label}</span>
                                  {isMulti && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                      {t("multiSelectLabel", { count: selectedMulti.length })}
                                    </Badge>
                                  )}
                                </label>

                                {isMulti && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const allValues = item.content!.actionSelect!.options.map((o) => o.value);
                                        setActionFormState((prev) => ({
                                          ...prev,
                                          [item.id]: { ...prev[item.id], multiSelect: allValues },
                                        }));
                                      }}
                                      className="text-[10px] text-primary hover:underline cursor-pointer"
                                    >
                                      {t("selectAll")}
                                    </button>
                                    <span className="text-[10px] text-muted-foreground/40">•</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionFormState((prev) => ({
                                          ...prev,
                                          [item.id]: { ...prev[item.id], multiSelect: [] },
                                        }));
                                      }}
                                      className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      {t("clear")}
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {item.content.actionSelect.options.map((opt) => {
                                  const isSelected = isMulti
                                    ? selectedMulti.includes(opt.value)
                                    : form.select === opt.value;

                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => {
                                        if (isMulti) {
                                          const next = isSelected
                                            ? selectedMulti.filter((v) => v !== opt.value)
                                            : [...selectedMulti, opt.value];
                                          setActionFormState((prev) => ({
                                            ...prev,
                                            [item.id]: { ...prev[item.id], multiSelect: next },
                                          }));
                                        } else {
                                          setActionFormState((prev) => ({
                                            ...prev,
                                            [item.id]: { ...prev[item.id], select: opt.value },
                                          }));
                                        }
                                      }}
                                      className={cn(
                                        "flex items-start gap-2 text-start p-2.5 rounded-xl border text-xs cursor-pointer transition-all",
                                        isSelected
                                          ? "bg-primary/15 border-primary text-primary font-semibold shadow-2xs"
                                          : "bg-background/80 border-border/70 hover:border-border text-foreground"
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
                                          <div className="size-3.5 rounded-full border-2 border-primary bg-primary flex items-center justify-center">
                                            <div className="size-1.5 rounded-full bg-background" />
                                          </div>
                                        ) : (
                                          <div className="size-3.5 rounded-full border border-muted-foreground/50" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <span className="font-semibold block truncate">{opt.label}</span>
                                        {opt.description && (
                                          <span className="text-[10px] text-muted-foreground/80 block mt-0.5 line-clamp-2">
                                            {opt.description}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              <Button
                                type="submit"
                                size="sm"
                                disabled={form.isSubmitting || (isMulti ? selectedMulti.length === 0 : !form.select)}
                                className="text-xs h-8 rounded-xl px-3 cursor-pointer mt-1"
                              >
                                <IconCheck className="size-3.5 mr-1" />
                                {isMulti
                                  ? t("submitSelected", { count: selectedMulti.length })
                                  : t("submit")}
                              </Button>
                            </form>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <Badge variant="default" className="text-xs px-2.5 py-1 rounded-xl font-semibold gap-1">
                                  <IconCheck className="size-3.5" />
                                  {t("submitted")}
                                </Badge>
                              </div>
                              {item.actionPayload?.selection && (
                                <div className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5 flex-wrap">
                                  <span>{t("selectedLabel")}:</span>
                                  {Array.isArray(item.actionPayload.selection) ? (
                                    item.actionPayload.selection.map((val: string) => {
                                      const matched = item.content?.actionSelect?.options.find((o) => o.value === val);
                                      return (
                                        <Badge key={val} variant="secondary" className="text-[10px] px-1.5 py-0">
                                          {matched?.label || val}
                                        </Badge>
                                      );
                                    })
                                  ) : (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      {item.content?.actionSelect?.options.find((o) => o.value === item.actionPayload.selection)?.label || String(item.actionPayload.selection)}
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
                      <div className="space-y-1.5 opacity-40 select-none blur-[2px]">
                        <div className="h-3.5 w-2/3 bg-muted-foreground/50 rounded-md" />
                        <div className="h-3 w-full bg-muted-foreground/30 rounded-md" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </main>

        {/* ========================================================================= */}
        {/* 5. FOOTER                                                                 */}
        {/* ========================================================================= */}
        <footer className="border-t border-border/60 px-4 sm:px-6 py-3 bg-card/40 shrink-0 flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full font-mono text-muted-foreground">
              {t("notificationCount", { count: filteredNotifications.length, total: notifications.length })}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onPress={() => onOpenChange(false)}
            className="rounded-xl text-xs cursor-pointer"
          >
            {t("close")}
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
