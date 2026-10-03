"use client"

import React, { useMemo } from "react"
import { useSession } from "next-auth/react"
import { useListSidebarConfig } from "@/config/sidebars/listSidebarConfig"
import { IrisSidebar } from "@/components/navigation/iris-sidebar"
import { useIrisSidebar } from "@/components/navigation/sidebar-provider"
import { SidebarInset, useSidebar } from "@workspace/ui/components/sidebar"
import { filterSidebarConfig } from "@/lib/navigation"
import { cn } from "@workspace/ui/lib/utils"

export interface IrisListNavProviderProps {
  children: React.ReactNode
}

export default function IrisListNavProvider({
  children,
}: IrisListNavProviderProps): React.JSX.Element {
  const { data: session } = useSession()
  const rawConfig = useListSidebarConfig(session)
  const { position } = useIrisSidebar()
  const { state } = useSidebar()

  const isHorizontal = position === "top" || position === "bottom"
  const isRight = position === "right"
  const isTop = position === "top"
  const isBottom = position === "bottom"

  const sidebarConfig = useMemo(() => {
    const userPermissions = (session?.user as any)?.permissions
    return filterSidebarConfig(rawConfig, userPermissions)
  }, [rawConfig, session?.user])

  return (
    <div
      className={cn(
        "flex size-full overflow-hidden bg-sidebar",
        isHorizontal ? "flex-col" : "flex-row"
      )}
    >
      {position === "left" && <IrisSidebar initialConfig={sidebarConfig} />}
      <SidebarInset
        className={cn(
          "no-scrollbar flex flex-1 min-h-0 min-w-0 flex-col overflow-y-auto bg-background pt-0",
          isRight &&
            (state === "collapsed"
              ? "md:m-2 md:rounded-2xl md:shadow-sm"
              : "md:m-2 md:me-0 md:rounded-2xl md:shadow-sm"),
          isTop &&
            "md:m-2 md:w-[calc(100%-1rem)] md:rounded-2xl md:shadow-sm",
          isBottom &&
            "md:m-2 md:w-[calc(100%-1rem)] md:rounded-2xl md:shadow-sm"
        )}
      >
        {position === "top" && <IrisSidebar initialConfig={sidebarConfig} />}
        {children}
        {position === "bottom" && <IrisSidebar initialConfig={sidebarConfig} />}
      </SidebarInset>
      {position === "right" && <IrisSidebar initialConfig={sidebarConfig} />}
    </div>
  )
}
