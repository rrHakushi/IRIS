import React, { useMemo } from "react"
import { useTranslations } from "next-intl"
import { type IRISBitFieldResolvable } from "@IRIS/permissions"
import { IconApps } from "@tabler/icons-react"

export interface IrisApp {
  id?: string
  name: string
  href: string
  color: string
  colorClass?: string
  bgClass?: string
  icon?: React.ReactNode
  iconLeftRing?: string
  iconLeftNoRing?: string
  iconRightRing?: string
  iconRightNoRing?: string
  description: string
  descriptionShort: string
  permissions?: IRISBitFieldResolvable
}

export function getIrisApps(t: (key: string) => string): IrisApp[] {
  return [
    {
      id: "iris-list",
      name: t("irisList.name"),
      href: "/IRIS-list",
      color: "#6366f1",
      colorClass: "text-indigo-500",
      bgClass: "bg-indigo-500",
      description: t("irisList.description"),
      descriptionShort: t("irisList.descriptionShort"),
      icon: <IconApps className="size-4 text-indigo-500" />,
    },
    // {
    //   name: "IRIS Cloud",
    //   href: "/cloud",
    //   color: "#f59e0b",
    //   description: "Cloud storage and tools.",
    //   descriptionShort: "Cloud storage and tools",
    //   icon: <IconKey className="size-4 text-amber-500" />,
    // },
    // {
    //   name: "IRIS Mail",
    //   href: "/mail",
    //   color: "#06b6d4",
    //   description: "Email and stuff.",
    //   descriptionShort: "Email",
    //   icon: <IconDatabase className="size-4 text-cyan-500" />,
    // },
    // {
    //   name: "IRIS Messages",
    //   href: "/messages",
    //   color: "#10b981",
    //   description: "Messages and stuff.",
    //   descriptionShort: "Messages",
    //   icon: <IconChartBar className="size-4 text-emerald-500" />,
    // },
    // {
    //   name: "IRIS Docs",
    //   href: "/docs",
    //   color: "#a855f7",
    //   description: "Knowledge base and documentation.",
    //   descriptionShort: "Docs",
    //   icon: <IconPuzzle className="size-4 text-purple-500" />,
    // },
  ]
}

export function useIrisApps(): IrisApp[] {
  const t = useTranslations("navigation.apps")
  return useMemo(() => getIrisApps(t), [t])
}

// export const irisApps: IrisApp[] = [
//   {
//     id: "iris-list",
//     name: "IRIS List",
//     href: "/list",
//     color: "#6366f1",
//     description: "Track your media. Watch, read, listen, and enjoy.",
//     descriptionShort: "Media tracking.",
//     icon: <IconApps className="size-4 text-indigo-500" />,
//   },
// ];
