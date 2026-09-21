import React, { useMemo } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { type IRISBitFieldResolvable } from "@IRIS/permissions"
import { cn } from "@workspace/ui/lib/utils"

export interface IrisApp {
  id: string
  name: string
  href: string
  color: string
  colorClass?: string
  bgClass?: string
  gradient?: string
  gradientStyle?: string
  icon?: string
  iconLeftRing?: string
  iconLeftNoRing?: string
  iconRightRing?: string
  iconRightNoRing?: string
  description: string
  descriptionShort: string
  permissions?: IRISBitFieldResolvable
}

export function renderIrisAppIcon(
  app: IrisApp | null | undefined,
  className = "size-5",
  style?: React.CSSProperties
): React.JSX.Element | null {
  if (!app) return null

  const iconSrc =
    app.icon ||
    app.iconLeftRing ||
    (app.id === "iris-list"
      ? "/iris-icons/iris-list-ring-left.png"
      : "/iris-icons/iris-pass-ring-left.png")

  return (
    <Image
      src={iconSrc}
      alt={app.name}
      width={96}
      height={96}
      style={style}
      className={cn("rounded-full object-contain", className)}
    />
  )
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
      gradient:
        "linear-gradient(135deg, #06b6d4 0%, #3b82f6 32%, #4f46e5 68%, #7c3aed 100%)",
      gradientStyle:
        "linear-gradient(135deg, #06b6d4 0%, #3b82f6 32%, #4f46e5 68%, #7c3aed 100%)",
      icon: "/iris-icons/iris-list-ring-left.png",
      iconLeftRing: "/iris-icons/iris-list-ring-left.png",
      description: t("irisList.description"),
      descriptionShort: t("irisList.descriptionShort"),
    },
    {
      id: "iris-pass",
      name: "IRIS Pass",
      href: "/IRIS-pass",
      color: "#d800a6",
      colorClass: "text-[#d800a6]",
      bgClass: "bg-[#d800a6]",
      gradient:
        "linear-gradient(135deg, #e11d48 0%, #c026d3 34%, #6366f1 72%, #4338ca 100%)",
      gradientStyle:
        "linear-gradient(135deg, #e11d48 0%, #c026d3 34%, #6366f1 72%, #4338ca 100%)",
      icon: "/iris-icons/iris-pass-ring-left.png",
      iconLeftRing: "/iris-icons/iris-pass-ring-left.png",
      description:
        "Zero-knowledge encrypted password, credential, and SSH key manager.",
      descriptionShort: "Vault & Generator",
    },
    // {
    //   id: "iris-cloud",
    //   name: "IRIS Cloud",
    //   href: "/cloud",
    //   color: "#f59e0b",
    //   colorClass: "text-amber-500",
    //   bgClass: "bg-amber-500",
    //   icon: "/iris-pass512left-ring.png",
    //   description: "Cloud storage and tools.",
    //   descriptionShort: "Cloud storage and tools",
    // },
    // {
    //   id: "iris-mail",
    //   name: "IRIS Mail",
    //   href: "/mail",
    //   color: "#06b6d4",
    //   colorClass: "text-cyan-500",
    //   bgClass: "bg-cyan-500",
    //   icon: "/iris-pass512left-ring.png",
    //   description: "Email and stuff.",
    //   descriptionShort: "Email",
    // },
    // {
    //   id: "iris-messages",
    //   name: "IRIS Messages",
    //   href: "/messages",
    //   color: "#10b981",
    //   colorClass: "text-emerald-500",
    //   bgClass: "bg-emerald-500",
    //   icon: "/iris-pass512left-ring.png",
    //   description: "Messages and stuff.",
    //   descriptionShort: "Messages",
    // },
    // {
    //   id: "iris-docs",
    //   name: "IRIS Docs",
    //   href: "/docs",
    //   color: "#a855f7",
    //   colorClass: "text-purple-500",
    //   bgClass: "bg-purple-500",
    //   icon: "/iris-pass512left-ring.png",
    //   description: "Knowledge base and documentation.",
    //   descriptionShort: "Docs",
    // },
  ]
}

export function useIrisApps(): IrisApp[] {
  const t = useTranslations("navigation.apps")
  return useMemo(() => getIrisApps(t), [t])
}
