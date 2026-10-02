"use client"

import React, { useMemo } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useIrisApps, renderIrisAppIcon, type IrisApp } from "@/config/irisApps"
import { hasPermission } from "@IRIS/permissions"
import { cn } from "@workspace/ui/lib/utils"

export interface IrisAppMenuProps {
  className?: string
}

export function IrisAppMenu({ className }: IrisAppMenuProps = {}): React.JSX.Element {
  const t = useTranslations("navigation.appMenu")
  const irisApps = useIrisApps()
  const pathname = usePathname() || "/"
  const { data: session } = useSession()

  const userPermissions = (session?.user as any)?.permissions ?? null

  const visibleApps = useMemo((): IrisApp[] => {
    return irisApps.filter((app: IrisApp): boolean => {
      if (!app.permissions) return true
      return hasPermission(userPermissions, app.permissions, "any")
    })
  }, [irisApps, userPermissions])

  const activeApp = useMemo(() => {
    const current = visibleApps.find((app) =>
      app.href !== "/" ? pathname.startsWith(app.href) : pathname === "/"
    )
    return current || visibleApps[0] || irisApps[0]
  }, [pathname, visibleApps, irisApps])

  return (
    <div
      className={cn(
        "group flex h-12 w-full max-w-[240px] items-center gap-2.5 rounded-xl border border-border/40 p-2 text-start select-none",
        className
      )}
    >
      {renderIrisAppIcon(activeApp, "size-8 text-primary-foreground")}

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          suppressHydrationWarning
          className={cn(
            "w-fit max-w-full truncate text-xs leading-tight font-bold",
            activeApp?.gradient
              ? "bg-clip-text text-transparent"
              : activeApp?.colorClass || "text-indigo-500"
          )}
          style={
            activeApp?.gradient
              ? { backgroundImage: activeApp.gradient }
              : undefined
          }
        >
          {activeApp?.name || "IRIS"}
        </span>
        <span className="truncate text-[10px] leading-tight font-normal text-muted-foreground">
          {activeApp?.descriptionShort ||
            activeApp?.description ||
            t("appCenter")}
        </span>
      </div>
    </div>
  )
}

export default IrisAppMenu
