import React, { useMemo } from "react"
import type { SidebarConfig } from "@/types/sidebar-config"
import {
  IconShieldLock,
  IconKey,
  IconNote,
  IconCreditCard,
  IconTerminal2,
  IconId,
  IconStar,
  IconTrash,
  IconSparkles,
} from "@tabler/icons-react"
import type { Session } from "@/context/session-context"

export function getPassSidebarConfig(
  session: Session | null,
  t?: (key: string) => string
): SidebarConfig {
  const tr = (key: string, fallback: string) => {
    if (!t) return fallback
    try {
      const res = t(key)
      return res && !res.includes(".") ? res : fallback
    } catch {
      return fallback
    }
  }

  return [
    // ----------------------------------------------------
    // Mobile-Only Bottom Dock (#$Phone)
    // ----------------------------------------------------
    {
      section: "#$Phone",
      dataKey: "mobile-dock",
      items: [
        {
          label: tr("vault", "Vault"),
          dataKey: "phone-vault",
          href: "/akaromi",
          icon: <IconShieldLock className="size-5" />,
          position: 1,
        },
        {
          label: tr("logins", "Logins"),
          dataKey: "phone-logins",
          href: "/akaromi/logins",
          icon: <IconKey className="size-5" />,
          position: 2,
        },
        {
          label: tr("notes", "Notes"),
          dataKey: "phone-notes",
          href: "/akaromi/notes",
          icon: <IconNote className="size-5" />,
          position: 3,
        },
        {
          label: tr("cards", "Cards"),
          dataKey: "phone-cards",
          href: "/akaromi/cards",
          icon: <IconCreditCard className="size-5" />,
          position: 4,
        },
        {
          label: tr("generator", "Generator"),
          dataKey: "phone-generator",
          href: "/akaromi/generator",
          icon: <IconSparkles className="size-5" />,
          position: 5,
        },
      ],
    },

    // ----------------------------------------------------
    // Vault Section
    // ----------------------------------------------------
    {
      section: tr("vault", "Vault"),
      dataKey: "vault-section",
      items: [
        {
          label: tr("allItems", "All Items"),
          dataKey: "vault-all",
          href: "/akaromi",
          icon: <IconShieldLock className="size-4" />,
          position: 1,
        },
        {
          label: tr("favorites", "Favorites"),
          dataKey: "vault-favorites",
          href: "/akaromi/favorites",
          icon: <IconStar className="size-4" />,
          position: 2,
        },
        {
          label: tr("logins", "Logins"),
          dataKey: "vault-logins",
          href: "/akaromi/logins",
          icon: <IconKey className="size-4" />,
          position: 3,
        },
        {
          label: tr("notes", "Secure Notes"),
          dataKey: "vault-notes",
          href: "/akaromi/notes",
          icon: <IconNote className="size-4" />,
          position: 4,
        },
        {
          label: tr("cards", "Credit Cards"),
          dataKey: "vault-cards",
          href: "/akaromi/cards",
          icon: <IconCreditCard className="size-4" />,
          position: 5,
        },
        {
          label: tr("sshKeys", "SSH Keys"),
          dataKey: "vault-ssh",
          href: "/akaromi/ssh",
          icon: <IconTerminal2 className="size-4" />,
          position: 6,
        },
        {
          label: tr("identities", "Identities"),
          dataKey: "vault-identities",
          href: "/akaromi/identities",
          icon: <IconId className="size-4" />,
          position: 7,
        },
        {
          label: tr("trash", "Trash"),
          dataKey: "vault-trash",
          href: "/akaromi/trash",
          icon: <IconTrash className="size-4" />,
          position: 8,
        },
      ],
    },

    // ----------------------------------------------------
    // Tools Section
    // ----------------------------------------------------
    {
      section: tr("tools", "Tools"),
      dataKey: "tools-section",
      items: [
        {
          label: tr("generator", "Generator"),
          dataKey: "tool-generator",
          href: "/akaromi/generator",
          icon: <IconSparkles className="size-4" />,
          position: 1,
        },
      ],
    },
  ]
}

export function usePassSidebarConfig(session: Session | null): SidebarConfig {
  return useMemo(() => getPassSidebarConfig(session), [session])
}
