import React, { useMemo, useState, useEffect } from "react"
import type { SidebarConfig, SidebarItem } from "@/types/sidebar-config"
import { useTranslations } from "next-intl"
import {
  IconHome,
  IconSearch,
  IconMovie,
  IconTheater,
  IconCalendar,
  IconTrophy,
  IconBook,
  IconList,
  IconMusic,
  IconDeviceGamepad,
  IconDeviceTv,
  IconBook2,
  IconListDetails,
  IconListCheck,
  IconCloudDownload,
} from "@tabler/icons-react"
import type { Session } from "@/context/session-context"
import { elysia } from "@/lib/elysia"

let cachedServarrProviders: string[] | null = null
let inFlightConnectionsPromise: Promise<string[] | null> | null = null

export function getListSidebarConfig(
  session: Session | null,
  t: (key: string) => string,
  connectedServarr: string[] = []
): SidebarConfig {
  const userId = session?.user?.id

  // Build servarr items based on connected servarr applications
  const servarrItems: SidebarItem[] = []
  const normalizedConnected = connectedServarr.map((s) => s.toUpperCase())

  if (normalizedConnected.includes("SONARR")) {
    servarrItems.push({
      label: t("sonarr") || "Sonarr",
      dataKey: "servarr-sonarr",
      href: `/borealis/servarr/sonarr`,
      icon: <IconDeviceTv className="size-4" />,
      children: [
        {
          label: t("series") || "Series",
          href: `/borealis/servarr/sonarr`,
          icon: <IconDeviceTv className="size-4" />,
        },
        {
          label: t("manageSeries") || "Manage Series",
          href: `/borealis/servarr/sonarr/manage`,
          icon: <IconListCheck className="size-4" />,
        },
        {
          label: t("activityQueue") || "Activity Queue",
          href: `/borealis/servarr/sonarr/queue`,
          icon: <IconCloudDownload className="size-4" />,
        },
        {
          label: t("wanted") || "Wanted & Cutoff",
          href: `/borealis/servarr/sonarr/wanted`,
          icon: <IconSearch className="size-4" />,
        },
        {
          label: t("history") || "History",
          href: `/borealis/servarr/sonarr/history`,
          icon: <IconListDetails className="size-4" />,
        },
      ],
    })
  }

  if (normalizedConnected.includes("RADARR")) {
    servarrItems.push({
      label: t("radarr") || "Radarr",
      dataKey: "servarr-radarr",
      href: `/borealis/servarr/radarr`,
      icon: <IconMovie className="size-4" />,
      children: [
        {
          label: t("movies") || "Movies",
          href: `/borealis/servarr/radarr`,
          icon: <IconMovie className="size-4" />,
        },
        {
          label: t("manageMovies") || "Manage Movies",
          href: `/borealis/servarr/radarr/manage`,
          icon: <IconListCheck className="size-4" />,
        },
        {
          label: t("activityQueue") || "Activity Queue",
          href: `/borealis/servarr/radarr/queue`,
          icon: <IconCloudDownload className="size-4" />,
        },
        {
          label: t("wanted") || "Wanted & Cutoff",
          href: `/borealis/servarr/radarr/wanted`,
          icon: <IconSearch className="size-4" />,
        },
        {
          label: t("history") || "History",
          href: `/borealis/servarr/radarr/history`,
          icon: <IconListDetails className="size-4" />,
        },
      ],
    })
  }

  if (normalizedConnected.includes("READARR")) {
    servarrItems.push({
      label: t("readarr") || "Readarr",
      dataKey: "servarr-readarr",
      href: `/borealis/servarr/readarr`,
      icon: <IconBook2 className="size-4" />,
    })
  }

  if (normalizedConnected.includes("LIDARR")) {
    servarrItems.push({
      label: t("lidarr") || "Lidarr",
      dataKey: "servarr-lidarr",
      href: `/borealis/servarr/lidarr`,
      icon: <IconMusic className="size-4" />,
    })
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
          label: t("home"),
          dataKey: "phone-home",
          href: "/borealis",
          icon: <IconHome className="size-5" />,
          position: 1,
        },
        {
          label: t("browse"),
          dataKey: "phone-browse",
          href: "/borealis/browse",
          icon: <IconSearch className="size-5" />,
          position: 2,
          children: [
            {
              label: t("browse"),
              href: "/borealis/browse",
              icon: <IconSearch className="size-4" />,
            },
            {
              label: t("rankings"),
              href: "/borealis/rankings",
              icon: <IconTrophy className="size-4" />,
            },
            {
              label: t("discover"),
              href: "/borealis/discover",
              icon: <IconSearch className="size-4" />,
            },
          ],
        },
        {
          label: t("calendar"),
          dataKey: "phone-calendar",
          href: "/borealis/calendar",
          icon: <IconCalendar className="size-5" />,
          position: 3,
        },
        ...(userId
          ? [
              {
                label: t("myLists"),
                dataKey: "phone-my-lists",
                icon: <IconList className="size-5" />,
                position: 4,
                children: [
                  {
                    label: t("anime"),
                    href: `/borealis/lists/${userId}/anime`,
                    icon: <IconTheater className="size-4" />,
                  },
                  {
                    label: t("manga"),
                    href: `/borealis/lists/${userId}/manga`,
                    icon: <IconBook className="size-4" />,
                  },
                  {
                    label: t("movie"),
                    href: `/borealis/lists/${userId}/movie`,
                    icon: <IconMovie className="size-4" />,
                  },
                  {
                    label: t("tv"),
                    href: `/borealis/lists/${userId}/tv`,
                    icon: <IconDeviceTv className="size-4" />,
                  },
                  {
                    label: t("game"),
                    href: `/borealis/lists/${userId}/game`,
                    icon: <IconDeviceGamepad className="size-4" />,
                  },
                  {
                    label: t("music"),
                    href: `/borealis/lists/${userId}/music`,
                    icon: <IconMusic className="size-4" />,
                  },
                  {
                    label: t("book"),
                    href: `/borealis/lists/${userId}/book`,
                    icon: <IconBook2 className="size-4" />,
                  },
                  {
                    label: t("other"),
                    href: `/borealis/lists/${userId}/other`,
                    icon: <IconList className="size-4" />,
                  },
                  {
                    label: t("customLists"),
                    href: `/borealis/lists/${userId}/custom-lists`,
                    icon: <IconListDetails className="size-4" />,
                  },
                ],
              },
            ]
          : []),
      ],
    },

    {
      section: "",
      dataKey: "home-section",
      items: [
        {
          label: t("home"),
          dataKey: "home",
          href: "/borealis",
          icon: <IconHome className="size-4" />,
          position: 1,
        },
        {
          label: t("browse"),
          dataKey: "browse",
          href: "/borealis/browse",
          icon: <IconSearch className="size-4" />,
          position: 2,
          children: [
            {
              label: t("rankings"),
              href: "/borealis/rankings",
              icon: <IconTrophy className="size-4" />,
            },
            {
              label: t("discover"),
              href: "/borealis/discover",
              icon: <IconSearch className="size-4" />,
            },
          ],
        },
        {
          label: t("calendar"),
          dataKey: "calendar",
          href: "/borealis/calendar",
          icon: <IconCalendar className="size-4" />,
        },
      ],
    },

    ...(userId
      ? [
          {
            section: t("library"),
            dataKey: "library",
            items: [
              {
                label: t("anime"),
                dataKey: "anime",
                href: `/borealis/lists/${userId}/anime`,
                icon: <IconTheater className="size-4" />,
              },
              {
                label: t("manga"),
                dataKey: "manga",
                href: `/borealis/lists/${userId}/manga`,
                icon: <IconBook className="size-4" />,
              },
              {
                label: t("movie"),
                dataKey: "movie",
                href: `/borealis/lists/${userId}/movie`,
                icon: <IconMovie className="size-4" />,
              },
              {
                label: t("tv"),
                dataKey: "tv",
                href: `/borealis/lists/${userId}/tv`,
                icon: <IconDeviceTv className="size-4" />,
              },
              {
                label: t("game"),
                dataKey: "game",
                href: `/borealis/lists/${userId}/game`,
                icon: <IconDeviceGamepad className="size-4" />,
              },
              {
                label: t("music"),
                dataKey: "music",
                href: `/borealis/lists/${userId}/music`,
                icon: <IconMusic className="size-4" />,
              },
              {
                label: t("book"),
                dataKey: "book",
                href: `/borealis/lists/${userId}/book`,
                icon: <IconBook2 className="size-4" />,
              },
              {
                label: t("other"),
                dataKey: "other",
                href: `/borealis/lists/${userId}/other`,
                icon: <IconList className="size-4" />,
              },
              {
                label: t("customLists"),
                dataKey: "custom-lists",
                href: `/borealis/lists/${userId}/custom-lists`,
                icon: <IconListDetails className="size-4" />,
              },
            ],
          },
        ]
      : []),

    ...(userId && servarrItems.length > 0
      ? [
          {
            section: t("servarr") || "Servarr",
            dataKey: "servarr",
            items: servarrItems,
          },
        ]
      : []),
  ]
}

export function useListSidebarConfig(
  session: Session | null,
  initialConnectedServarr?: string[]
): SidebarConfig {
  const t = useTranslations("navigation.listSidebar")
  const userId = session?.user?.id

  const [connectedServarr, setConnectedServarr] = useState<string[]>(
    () => initialConnectedServarr ?? cachedServarrProviders ?? []
  )

  useEffect(() => {
    if (!userId) {
      cachedServarrProviders = null
      setConnectedServarr([])
      return
    }

    let isMounted = true

    async function fetchConnections(force = false) {
      if (!force && cachedServarrProviders !== null) {
        if (isMounted) setConnectedServarr(cachedServarrProviders)
        return
      }

      if (inFlightConnectionsPromise) {
        const result = await inFlightConnectionsPromise
        if (result && isMounted) {
          setConnectedServarr(result)
        }
        return
      }

      inFlightConnectionsPromise = (async () => {
        try {
          const { data, error } = await elysia.carina.connections.get({
            fetch: { credentials: "include" },
          })

          if (!error && data?.success) {
            const servarrSet = new Set<string>()
            for (const conn of data.connections) {
              if (conn.status === "CONNECTED") {
                const prov = conn.provider.toUpperCase()
                if (["SONARR", "RADARR", "READARR", "LIDARR"].includes(prov)) {
                  servarrSet.add(prov)
                }
              }
            }
            const list = Array.from(servarrSet)
            cachedServarrProviders = list
            return list
          }
          return null
        } catch {
          return null
        } finally {
          inFlightConnectionsPromise = null
        }
      })()

      const list = await inFlightConnectionsPromise
      if (list && isMounted) {
        setConnectedServarr((prev) => {
          if (
            prev.length === list.length &&
            prev.every((p) => list.includes(p))
          ) {
            return prev
          }
          return list
        })
      }
    }

    if (cachedServarrProviders === null) {
      fetchConnections()
    }

    const handleUpdate = () => {
      fetchConnections(true)
    }
    window.addEventListener("iris-connections-changed", handleUpdate)
    window.addEventListener("iris-sidebar-changed", handleUpdate)

    return () => {
      isMounted = false
      window.removeEventListener("iris-connections-changed", handleUpdate)
      window.removeEventListener("iris-sidebar-changed", handleUpdate)
    }
  }, [userId])

  return useMemo(
    () => getListSidebarConfig(session, t, connectedServarr),
    [session, t, connectedServarr]
  )
}
