"use client"

import React, { useMemo } from "react"
import { useSession } from "next-auth/react"
import { usePassSidebarConfig } from "@/config/sidebars/passSidebarConfig"
import { IrisSidebar } from "@/components/navigation/iris-sidebar"
import { filterSidebarConfig } from "@/lib/navigation"

export interface IrisPassNavProviderProps {
  children: React.ReactNode
}

export default function IrisPassNavProvider({
  children,
}: IrisPassNavProviderProps): React.JSX.Element {
  const { data: session } = useSession()
  const rawConfig = usePassSidebarConfig(session)

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
