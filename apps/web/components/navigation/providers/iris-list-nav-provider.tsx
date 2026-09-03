"use client"

import React, { useMemo } from "react"
import { useSession } from "next-auth/react"
import { useListSidebarConfig } from "@/config/sidebars/listSidebarConfig"
import { IrisSidebar } from "@/components/navigation/iris-sidebar"
import { filterSidebarConfig } from "@/lib/navigation"

export interface IrisListNavProviderProps {
  children: React.ReactNode
}

export default function IrisListNavProvider({
  children,
}: IrisListNavProviderProps): React.JSX.Element {
  const { data: session } = useSession()
  const rawConfig = useListSidebarConfig(session)

  const sidebarConfig = useMemo(() => {
    const userPermissions = (session?.user as any)?.permissions
    return filterSidebarConfig(rawConfig, userPermissions)
  }, [rawConfig, session?.user])

  return (
    <>
      <IrisSidebar initialConfig={sidebarConfig} />
      {children}
    </>
  )
}
