"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  IconBell,
  IconSettings,
  IconPalette,
  IconLanguage,
  IconChevronRight,
  IconCheck,
  IconUsers,
  IconShieldCheck,
  IconShieldLock,
  IconLogout,
  IconLogin,
} from "@tabler/icons-react";
import { useIrisSidebar } from "./sidebar-provider";
import { IrisSidebarUserCard } from "./iris-sidebar-user-card";
import { IrisNotificationsModal } from "./iris-notifications-modal";
import { IrisFriendsModal } from "./iris-friends-modal";
import {
  IrisSettingsModal,
  type IrisSettingsCategory,
} from "./iris-settings-modal";
import { formatBadgeNumber } from "@/lib/numbers";
import { useNotifications } from "@/context/notification-context";
import { useUser } from "@/context/user-context";
import { useEncryption } from "@/context/encryption-context";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { locales, localeNames, type Locale } from "@/i18n/routing";
import { toast } from "sonner";

export interface IrisUserMenuProps {
  onOpenSettings?: () => void;
  placement?: any;
}

export function IrisUserMenu({
  onOpenSettings,
  placement,
}: IrisUserMenuProps): React.JSX.Element {
  const t = useTranslations("navigation.userMenu");
  const { data: session } = useSession();
  const { user } = useUser();
  const { isActive: isEncryptionActive } = useEncryption();
  const { unreadCount, isModalOpen: notificationsOpen, setIsModalOpen: setNotificationsOpen } = useNotifications();
  const { theme, setTheme } = useTheme();
  const { position } = useIrisSidebar();
  const isRight = position === "right";
  const [menuOpen, setMenuOpen] = useState(false);

  // Modal open states
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDefaultCategory, setSettingsDefaultCategory] =
    useState<IrisSettingsCategory>("profile");

  // Automatically open settings on connections tab and alert on OAuth return
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const provider = params.get("provider");
    const tab = params.get("tab") || params.get("openSettings");

    if (status || tab === "connections" || provider) {
      if (status === "connected" && provider) {
        toast.success(`Successfully connected to ${provider}!`);
      } else if (status === "error") {
        const msg = params.get("message");
        toast.error(msg ? decodeURIComponent(msg) : "Connection failed");
      }

      setSettingsDefaultCategory("connections");
      setSettingsOpen(true);

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("status");
      cleanUrl.searchParams.delete("provider");
      cleanUrl.searchParams.delete("message");
      cleanUrl.searchParams.delete("tab");
      cleanUrl.searchParams.delete("openSettings");
      window.history.replaceState(
        {},
        document.title,
        cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : "")
      );
    }
  }, []);

  const router = useRouter();
  const currentLocale = useLocale() as Locale;
  const localeMeta = localeNames[currentLocale] ?? localeNames.en;

  const displayName = user?.displayName || user?.username;
  const userEmail = user?.email;
  const username = user?.username;

  const defaultPlacement = isRight ? "left bottom" : "right bottom";
  const resolvedPlacement = placement ?? defaultPlacement;

  const handleSelectLanguage = (nextLocale: Locale) => {
    if (!nextLocale || nextLocale === currentLocale) return;
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  };

  if (!session?.user) {
    return (
      <Button
        variant="ghost"
        className="h-10 w-full justify-start gap-2.5 px-3 rounded-2xl group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center cursor-pointer"
        onClick={() => {
          setMenuOpen(false);
          signIn();
        }}
      >
        <IconLogin className="size-4 shrink-0" />
        <span className="truncate group-data-[collapsible=icon]:hidden">{t("logIn")}</span>
      </Button>
    );
  }

  return (
    <>
      <DropdownMenuTrigger isOpen={menuOpen} onOpenChange={setMenuOpen}>
        {/* Closed Menu Button Trigger */}
        <Button
          variant="ghost"
          className="h-12 w-full p-0 border-0 bg-transparent hover:bg-transparent focus-visible:ring-0 overflow-hidden cursor-pointer"
        >
          <IrisSidebarUserCard
            nameplateUrl={user?.nameplateUrl || user?.sidebarCardBackgroundUrl}
            avatarUrl={user?.avatarUrl}
            avatarFrame={user?.avatarFrame}
            displayName={displayName}
            displayNameStyle={user?.displayNameStyle}
            statusText={user?.statusText}
            username={username}
            email={userEmail}
            unreadCount={unreadCount}
            showChevrons
            className="h-full w-full border-border/40 hover:border-border/80 hover:bg-muted/50 data-[state=open]:bg-muted/80 data-[state=open]:border-border"
          />
        </Button>

        {/* Opened Dropdown Menu */}
        <DropdownMenu
          placement={resolvedPlacement}
          offset={6}
          className="w-(--trigger-width) min-w-60 rounded-2xl p-1.5"
        >
          {/* User Card Label Header */}
          <DropdownMenuLabel className="p-0 font-normal normal-case tracking-normal">
            <Link
              href={`/IRIS-account/users/${username}`}
              onClick={() => setMenuOpen(false)}
            >
              <IrisSidebarUserCard
                nameplateUrl={user?.nameplateUrl || user?.sidebarCardBackgroundUrl}
                avatarUrl={user?.avatarUrl}
                avatarFrame={user?.avatarFrame}
                displayName={displayName}
                displayNameStyle={user?.displayNameStyle}
                statusText={user?.statusText}
                username={username}
                email={userEmail}
                showEmail
                showChevrons={false}
                className="border-border/50 hover:border-border hover:bg-muted/70 mb-1 py-2.5"
              />
            </Link>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Action Group 1 */}
          <DropdownMenuGroup>
            <DropdownMenuItem
              onAction={() => {
                setMenuOpen(false);
                setNotificationsOpen(true);
              }}
            >
              <IconBell className="size-4" />
              <span>{t("notifications")}</span>
              {unreadCount > 0 && (
                <Badge className="ms-auto h-4 px-1 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center min-w-4">
                  {formatBadgeNumber(unreadCount, 2)}
                </Badge>
              )}
            </DropdownMenuItem>

            <DropdownMenuItem
              onAction={() => {
                setMenuOpen(false);
                setFriendsOpen(true);
              }}
            >
              <IconUsers className="size-4" />
              <span>{t("friends")}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Action Group 2: Utilities & Settings */}
          <DropdownMenuGroup>
            <DropdownMenuItem
              onAction={() => {
                setMenuOpen(false);
                setTheme(theme === "dark" ? "light" : "dark");
              }}
            >
              <IconPalette className="size-4" />
              <span>{t("appearance")}</span>
              <span className="ms-auto text-[10px] text-muted-foreground capitalize">
                {theme || "dark"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onAction={() => {
                setMenuOpen(false);
                setSettingsDefaultCategory("profile");
                setSettingsOpen(true);
                onOpenSettings?.();
              }}
            >
              <IconSettings className="size-4" />
              <span>{t("settings")}</span>
            </DropdownMenuItem>

            <DropdownMenuTrigger>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-1.5 h-auto font-medium text-xs hover:bg-muted/80 focus:bg-muted/80 cursor-pointer border-0 bg-transparent text-inherit"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <IconLanguage className="size-4 shrink-0" />
                  <span>{t("language")}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground ms-auto shrink-0 font-normal">
                  <span>{localeMeta.flag}</span>
                  <span>{localeMeta.nativeName}</span>
                  <IconChevronRight className="size-3.5 opacity-60" />
                </div>
              </Button>

              <DropdownMenu
                placement={isRight ? "left top" : "right top"}
                offset={8}
                className="min-w-44 rounded-2xl p-1.5"
              >
                <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t("selectLanguage")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {locales.map((loc) => {
                    const meta = localeNames[loc];
                    const isSelected = loc === currentLocale;
                    return (
                      <DropdownMenuItem
                        key={loc}
                        onAction={() => {
                          handleSelectLanguage(loc);
                          setMenuOpen(false);
                        }}
                        className="justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{meta.flag}</span>
                          <span>{meta.nativeName}</span>
                        </div>
                        {isSelected && (
                          <IconCheck className="size-3.5 text-primary ms-auto" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenu>
            </DropdownMenuTrigger>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuItem
              onAction={() => {
                setMenuOpen(false);
                setSettingsDefaultCategory("encryption");
                setSettingsOpen(true);
              }}
            >
              {isEncryptionActive ? (
                <IconShieldCheck className="size-4 text-emerald-400" />
              ) : (
                <IconShieldLock className="size-4 text-amber-400" />
              )}
              <span>{t("encryption")}</span>
              {isEncryptionActive ? (
                <Badge className="ms-auto h-4 px-1.5 border text-[8px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  {t("active")}
                </Badge>
              ) : (
                <Badge className="ms-auto h-4 px-1.5 border text-[8px] font-bold rounded-full bg-amber-500/10 text-amber-400 border-amber-500/20">
                  {t("locked")}
                </Badge>
              )}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Sign In / Sign Out */}
          {session ? (
            <DropdownMenuItem
              variant="destructive"
              onAction={() => {
                setMenuOpen(false);
                signOut({ redirect: false });
              }}
            >
              <IconLogout className="size-4 text-red-400" />
              <span className="font-bold text-red-400">{t("logOut")}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onAction={() => {
                setMenuOpen(false);
                signIn();
              }}
            >
              <IconLogin className="size-4 text-primary" />
              <span className="font-bold text-primary">{t("logIn")}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenu>
      </DropdownMenuTrigger>

      {/* Modals triggered from User Menu */}
      <IrisNotificationsModal
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
      />
      <IrisFriendsModal
        open={friendsOpen}
        onOpenChange={setFriendsOpen}
      />
      <IrisSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultCategory={settingsDefaultCategory}
      />
    </>
  );
}
