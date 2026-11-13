import React, { useMemo } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { type IRISBitFieldResolvable } from "@NamelessLiberty/permissions"
import { cn } from "@workspace/ui/lib/utils"

export interface IrisApp {
  id: string
  name: string
  href: string
  color: string
  gradient?: string
  icon?: string
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

  const iconSrc = app.icon || ""

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
      id: "carina",
      name: t ? t("irisAccount.name") : "Carina",
      href: "/carina",
      color: "#f59e0b",
      gradient:
        "linear-gradient(135deg, #fbbf24 0%, #f97316 25%, #fb7185 50%, #e11d48 75%, #881337 100%)",
      icon: "/icons/carina.png",
      description: t
        ? t("irisAccount.description")
        : "Unified identity, user profile, security, and sessions.",
      descriptionShort: t
        ? t("irisAccount.descriptionShort")
        : "Identity & Personal stuff",
    },
    {
      id: "borealis",
      name: t ? t("irisList.name") : "Borealis",
      href: "/borealis",
      color: "#6366f1",
      gradient:
        "linear-gradient(135deg, #06b6d4 0%, #3b82f6 32%, #4f46e5 68%, #7c3aed 100%)",
      icon: "/icons/borealis.png",
      description: t("irisList.description"),
      descriptionShort: t("irisList.descriptionShort"),
    },
    {
      id: "akaromi",
      name: t ? t("irisPass.name") : "Akaromi",
      href: "/akaromi",
      color: "#d800a6",
      gradient:
        "linear-gradient(135deg, #e11d48 0%, #c026d3 34%, #6366f1 72%, #4338ca 100%)",
      icon: "/icons/akaromi.png",
      description: t
        ? t("irisPass.description")
        : "Zero-knowledge encrypted password, credential, and SSH key manager.",
      descriptionShort: t
        ? t("irisPass.descriptionShort")
        : "Password management",
    },
    {
      id: "kiroshi",
      name: t ? t("irisSearch.name") : "Kiroshi",
      href: "/kiroshi",
      color: "#06b6d4",
      gradient:
        "linear-gradient(135deg, #10b981 0%, #06b6d4 25%, #2563eb 50%, #7c3aed 75%, #1e1b4b 100%)",
      icon: "/icons/kiroshi.png",
      description: t
        ? t("irisSearch.description")
        : "Web and meta-search.",
      descriptionShort: t
        ? t("irisSearch.descriptionShort")
        : "Web Search",
    },
    {
      id: "tesseract",
      name: t ? t("irisTesseract.name") : "Tesseract",
      href: "/tesseract",
      color: "#84cc16",
      gradient:
        "linear-gradient(135deg, #ecfccb 0%, #a3e635 25%, #84cc16 50%, #4d7c0f 75%, #1a2e05 100%)",
      icon: "/icons/tesseract.png",
      description: t
        ? t("irisTesseract.description")
        : "Local network file, folder, and text sharing.",
      descriptionShort: t
        ? t("irisTesseract.descriptionShort")
        : "Local file sharing",
    },
    // {
    //   id: "apertune",
    //   name: "Apertune",
    //   href: "/apertune",
    //   color: "#ec4899",
    //   gradient:
    //     "linear-gradient(135deg, #fbcfe8 0%, #f472b6 25%, #ec4899 50%, #be185d 75%, #500724 100%)",
    //   icon: "/icons/apertune.png",
    //   description: "Music player and audio streaming.",
    //   descriptionShort: "Music player",
    // },
    // {
    //   id: "reliquary",
    //   name: "Reliquary",
    //   href: "/reliquary",
    //   color: "#9333ea",
    //   gradient:
    //     "linear-gradient(135deg, #e9d5ff 0%, #c084fc 25%, #9333ea 50%, #6b21a8 75%, #2e1065 100%)",
    //   icon: "/icons/reliquary.png",
    //   description: "Knowledge base, guides, and documentation.",
    //   descriptionShort: "Docs & guides",
    // },
    // {
    //   id: "spica",
    //   name: "Spica",
    //   href: "/spica",
    //   color: "#0ea5e9",
    //   gradient:
    //     "linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 25%, #0ea5e9 50%, #0369a1 75%, #0c4a6e 100%)",
    //   icon: "/icons/spica.png",
    //   description: "Real-time chatting and messaging.",
    //   descriptionShort: "Chatting",
    // },
    // {
    //   id: "astra",
    //   name: "Astra",
    //   href: "/astra",
    //   color: "#f97316",
    //   gradient:
    //     "linear-gradient(135deg, #ffedd5 0%, #fb923c 25%, #f97316 50%, #c2410c 75%, #7c2d12 100%)",
    //   icon: "/icons/astra.png",
    //   description: "Email client and inbox management.",
    //   descriptionShort: "Email client",
    // },
    // {
    //   id: "amadeus",
    //   name: "Amadeus",
    //   href: "/amadeus",
    //   color: "#14b8a6",
    //   gradient:
    //     "linear-gradient(135deg, #ccfbf1 0%, #5eead4 25%, #14b8a6 50%, #0f766e 75%, #134e4a 100%)",
    //   icon: "/icons/amadeus.png",
    //   description: "Cloud storage and file management.",
    //   descriptionShort: "Cloud storage",
    // },
    // {
    //   id: "vex",
    //   name: "Vex",
    //   href: "/vex",
    //   color: "#ef4444",
    //   gradient:
    //     "linear-gradient(135deg, #fecaca 0%, #f87171 25%, #ef4444 50%, #b91c1c 75%, #450a0a 100%)",
    //   icon: "/icons/vex.png",
    //   description: "Link shortener and URL management.",
    //   descriptionShort: "Link shortener",
    // },
    // {
    //   id: "nyxis",
    //   name: "Nyxis",
    //   href: "/nyxis",
    //   color: "#10b981",
    //   gradient:
    //     "linear-gradient(135deg, #a7f3d0 0%, #34d399 25%, #10b981 50%, #047857 75%, #022c22 100%)",
    //   icon: "/icons/nyxis.png",
    //   description: "Financial tracking, receipt scanning, and currency tools.",
    //   descriptionShort: "Financial tracking",
    // },
  ]
}

export function useIrisApps(): IrisApp[] {
  const t = useTranslations("navigation.apps")
  return useMemo(() => getIrisApps(t), [t])
}
