"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconUser,
  IconInfoCircle,
  IconShieldCheck,
  IconLock,
  IconKey,
  IconLink,
  IconEyeCheck,
  IconPalette,
  IconLayoutSidebar,
  IconDeviceMobile,
  IconFileImport,
  IconFileExport,
  IconDeviceTv,
  IconMovie,
  IconBook,
  IconMail,
  IconX,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

// Account Tabs
import { ProfileSettingsTab } from "./settings-tabs/account/profile-tab"
import { InfoSettingsTab } from "./settings-tabs/account/info-tab"
import { SecuritySettingsTab } from "./settings-tabs/account/security-tab"
import { EncryptionSettingsTab } from "./settings-tabs/account/encryption-tab"
import { ApiKeysSettingsTab } from "./settings-tabs/account/api-keys-tab"
import { ConnectionsSettingsTab } from "./settings-tabs/account/connections-tab"
import { PrivacySettingsTab } from "./settings-tabs/account/privacy-tab"

// Customization Tabs
import { AppearanceSettingsTab } from "./settings-tabs/customization/appearance-tab"
import { SidebarSettingsTab } from "./settings-tabs/customization/sidebar-tab"
import { DockSettingsTab } from "./settings-tabs/customization/dock-tab"
import { MediaPreferencesSettingsTab } from "./settings-tabs/customization/media-preferences-tab"

// Lists Tabs
import { ListsImportSettingsTab } from "./settings-tabs/lists/lists-import-tab"
import { ListsExportSettingsTab } from "./settings-tabs/lists/lists-export-tab"

// Servarr Tabs
import { SonarrSettingsTab } from "./settings-tabs/servarr/sonarr-tab"
import { RadarrSettingsTab } from "./settings-tabs/servarr/radarr-tab"
import { ReadarrSettingsTab } from "./settings-tabs/servarr/readarr-tab"

// Email Tabs
import { EmailAccountsSettingsTab } from "./settings-tabs/email/email-accounts-tab"

import { useIsMobile } from "@workspace/ui/hooks/use-mobile"

export type IrisSettingsCategory =
  | "profile"
  | "info"
  | "security"
  | "encryption"
  | "apiKeys"
  | "connections"
  | "privacy"
  | "appearance"
  | "sidebar"
  | "dock"
  | "mediaPreferences"
  | "import"
  | "export"
  | "sonarr"
  | "radarr"
  | "readarr"
  | "accounts"

export interface SettingItemMeta {
  id: IrisSettingsCategory
  name: string
  icon: React.ComponentType<{ className?: string }>
  group: string
}

function renderTabContent(
  category: IrisSettingsCategory,
  onOpenChange: (open: boolean) => void,
  setFooterContent: (node: React.ReactNode | null) => void
) {
  switch (category) {
    case "profile":
      return (
        <ProfileSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "info":
      return (
        <InfoSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "security":
      return (
        <SecuritySettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "encryption":
      return (
        <EncryptionSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "apiKeys":
      return (
        <ApiKeysSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "connections":
      return (
        <ConnectionsSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "privacy":
      return (
        <PrivacySettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "appearance":
      return (
        <AppearanceSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "sidebar":
      return (
        <SidebarSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "dock":
      return (
        <DockSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "mediaPreferences":
      return (
        <MediaPreferencesSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "import":
      return (
        <ListsImportSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "export":
      return (
        <ListsExportSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "sonarr":
      return (
        <SonarrSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "radarr":
      return (
        <RadarrSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "readarr":
      return (
        <ReadarrSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    case "accounts":
      return (
        <EmailAccountsSettingsTab
          onOpenChange={onOpenChange}
          setFooterContent={setFooterContent}
        />
      )
    default:
      return null
  }
}

export interface IrisSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultCategory?: IrisSettingsCategory | null
}

export function IrisSettingsModal({
  open,
  onOpenChange,
  defaultCategory = "profile",
}: IrisSettingsModalProps): React.JSX.Element {
  const t = useTranslations("navigation.settings")
  const isMobile = useIsMobile()

  const navItems: SettingItemMeta[] = useMemo(
    () => [
      // Account
      {
        id: "profile",
        name: t("tabs.profile"),
        icon: IconUser,
        group: t("groups.account"),
      },
      {
        id: "info",
        name: t("tabs.info"),
        icon: IconInfoCircle,
        group: t("groups.account"),
      },
      {
        id: "security",
        name: t("tabs.security"),
        icon: IconShieldCheck,
        group: t("groups.account"),
      },
      {
        id: "encryption",
        name: t("tabs.encryption"),
        icon: IconLock,
        group: t("groups.account"),
      },
      {
        id: "apiKeys",
        name: t("tabs.apiKeys"),
        icon: IconKey,
        group: t("groups.account"),
      },
      {
        id: "connections",
        name: t("tabs.connections"),
        icon: IconLink,
        group: t("groups.account"),
      },
      {
        id: "privacy",
        name: t("tabs.privacy"),
        icon: IconEyeCheck,
        group: t("groups.account"),
      },

      // Customization
      {
        id: "appearance",
        name: t("tabs.appearance"),
        icon: IconPalette,
        group: t("groups.customization"),
      },
      {
        id: "sidebar",
        name: t("tabs.sidebar"),
        icon: IconLayoutSidebar,
        group: t("groups.customization"),
      },
      {
        id: "dock",
        name: t("tabs.dock"),
        icon: IconDeviceMobile,
        group: t("groups.customization"),
      },
      {
        id: "mediaPreferences",
        name: t("tabs.media"),
        icon: IconMovie,
        group: t("groups.customization"),
      },

      // Lists
      {
        id: "import",
        name: t("tabs.import"),
        icon: IconFileImport,
        group: t("groups.lists"),
      },
      {
        id: "export",
        name: t("tabs.export"),
        icon: IconFileExport,
        group: t("groups.lists"),
      },

      // Servarr
      {
        id: "sonarr",
        name: t("tabs.sonarr"),
        icon: IconDeviceTv,
        group: t("groups.servarr"),
      },
      {
        id: "radarr",
        name: t("tabs.radarr"),
        icon: IconMovie,
        group: t("groups.servarr"),
      },
      {
        id: "readarr",
        name: t("tabs.readarr"),
        icon: IconBook,
        group: t("groups.servarr"),
      },

      // Email
      {
        id: "accounts",
        name: t("tabs.accounts"),
        icon: IconMail,
        group: t("groups.email"),
      },
    ],
    [t]
  )

  const [desktopCategory, setDesktopCategory] = useState<IrisSettingsCategory>(
    defaultCategory || "profile"
  )
  const [mobileCategory, setMobileCategory] =
    useState<IrisSettingsCategory | null>(null)
  const [footerContent, setFooterContent] = useState<React.ReactNode | null>(
    null
  )

  // When modal opens, reset desktop to default and mobile to root list
  useEffect(() => {
    if (open) {
      setDesktopCategory(defaultCategory || "profile")
      setMobileCategory(null)
    }
  }, [open, defaultCategory])

  useEffect(() => {
    setFooterContent(null)
  }, [desktopCategory, mobileCategory])

  const activeMobileItem = mobileCategory
    ? (navItems.find((item) => item.id === mobileCategory) ?? null)
    : null

  const groupedNavItems = useMemo(() => {
    const groups: { group: string; items: SettingItemMeta[] }[] = []
    navItems.forEach((item) => {
      let group = groups.find((g) => g.group === item.group)
      if (!group) {
        group = { group: item.group, items: [] }
        groups.push(group)
      }
      group.items.push(item)
    })
    return groups
  }, [navItems])

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      showCloseButton={false}
      className="inset-0 top-0 left-0 h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none p-0 sm:fixed sm:inset-auto sm:start-1/2 sm:top-1/2 sm:h-[90vh] sm:max-h-[90vh] sm:w-[85vw] sm:max-w-[85vw] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl [&>[data-slot=dialog]]:flex [&>[data-slot=dialog]]:h-full [&>[data-slot=dialog]]:min-h-0 [&>[data-slot=dialog]]:flex-col [&>[data-slot=dialog]]:overflow-hidden"
    >
      <DialogTitle className="sr-only">{t("title")}</DialogTitle>
      <DialogDescription className="sr-only">
        {t("description")}
      </DialogDescription>

      {/* ========================================================================= */}
      {/* 1. DESKTOP VIEW (md:flex) -> Left Sidebar + Right Tab Content            */}
      {/* ========================================================================= */}
      <div className="relative hidden h-full min-h-0 w-full flex-row overflow-hidden rounded-3xl border border-border bg-background md:flex">
        {/* Floating Close Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onPress={() => onOpenChange(false)}
          className="absolute top-3.5 right-3.5 z-20 size-8 cursor-pointer rounded-xl text-muted-foreground hover:text-foreground"
          aria-label={t("closeSettings")}
        >
          <IconX className="size-4" />
        </Button>

        {/* Left Sidebar */}
        <aside className="flex h-full min-h-0 w-60 min-w-56 shrink-0 flex-col border-r border-border/60 bg-card/60">
          <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
            {groupedNavItems.map((group) => (
              <div key={group.group} className="space-y-0.5">
                <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-muted-foreground/75 uppercase">
                  {group.group}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isSelected = desktopCategory === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setDesktopCategory(item.id)
                        }}
                        className={cn(
                          "group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-start text-xs font-medium transition-all",
                          isSelected
                            ? "border-primary/30 bg-primary/15 font-semibold text-primary shadow-2xs"
                            : "border-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            isSelected
                              ? "text-primary"
                              : "text-primary/75 group-hover:text-primary"
                          )}
                        />
                        <span className="truncate">{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
          {/* Active Tab Scrollable Content */}
          <div className="no-scrollbar flex-1 overflow-y-auto p-6">
            <div className="h-full w-full">
              {!isMobile &&
                renderTabContent(
                  desktopCategory,
                  onOpenChange,
                  setFooterContent
                )}
            </div>
          </div>

          {/* Desktop Pinned Footer */}
          {footerContent ? (
            <footer className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-6 py-3">
              {footerContent}
            </footer>
          ) : (
            <footer className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-card/40 px-6 py-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 py-0 text-[10px]"
                >
                  IRIS
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onPress={() => onOpenChange(false)}
              >
                {t("close")}
              </Button>
            </footer>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE VIEW (md:hidden) -> Discord Mobile Drilldown Navigation         */}
      {/* ========================================================================= */}
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-none border-0 bg-background md:hidden">
        {/* Mobile Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-muted/10 px-4">
          {activeMobileItem ? (
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setMobileCategory(null)}
                className="-ml-2 shrink-0 cursor-pointer gap-1.5 rounded-xl px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <IconChevronLeft className="size-4" />
                <span className="font-medium">{t("back")}</span>
              </Button>
              <div className="mx-1 h-4 w-px shrink-0 bg-border/60" />
              <div className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-foreground">
                <activeMobileItem.icon className="size-4 shrink-0 text-primary" />
                <span className="truncate">{activeMobileItem.name}</span>
              </div>
            </div>
          ) : (
            <h2 className="text-sm font-bold tracking-tight text-foreground">
              {t("title")}
            </h2>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onPress={() => onOpenChange(false)}
            className="size-8 shrink-0 cursor-pointer rounded-xl text-muted-foreground hover:text-foreground"
            aria-label={t("closeSettings")}
          >
            <IconX className="size-4" />
          </Button>
        </header>

        {/* Mobile Content Area */}
        <main className="no-scrollbar min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
          {isMobile && mobileCategory ? (
            /* Sub-View: Active Tab Content */
            <div className="animate-in p-4 duration-200 fade-in slide-in-from-right-4">
              {renderTabContent(mobileCategory, onOpenChange, setFooterContent)}
            </div>
          ) : (
            /* Root View: Grouped List */
            <div className="animate-in space-y-5 p-4 duration-200 fade-in slide-in-from-left-4">
              {groupedNavItems.map((group) => (
                <div key={group.group} className="space-y-2">
                  <div className="px-2 text-[10px] font-bold tracking-wider text-muted-foreground/75 uppercase">
                    {group.group}
                  </div>
                  <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xs">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setMobileCategory(item.id)
                          }}
                          className="group flex w-full cursor-pointer items-center justify-between px-4 py-3 text-start text-xs font-medium text-foreground transition-all hover:bg-primary/10 hover:text-primary active:bg-primary/15"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Icon className="size-4.5 shrink-0 text-primary/75 transition-colors group-hover:text-primary" />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <IconChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Mobile Pinned Footer */}
        {isMobile && mobileCategory && footerContent ? (
          <footer className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 py-3">
            {footerContent}
          </footer>
        ) : isMobile ? (
          <footer className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-card/40 px-4 py-3">
            <Badge variant="outline" className="h-4 px-1.5 py-0 text-[10px]">
              IRIS
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onPress={() =>
                mobileCategory ? setMobileCategory(null) : onOpenChange(false)
              }
            >
              {mobileCategory ? t("back") : t("close")}
            </Button>
          </footer>
        ) : null}
      </div>
    </Dialog>
  )
}
