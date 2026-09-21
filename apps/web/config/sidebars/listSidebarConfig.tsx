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
import { Session } from "next-auth"
import { elysia } from "@/lib/elysia"

let cachedServarrProviders: string[] | null = null

export function getListSidebarConfig(
  session: Session | null,
  t: (key: string) => string,
  connectedServarr: string[] = []
): SidebarConfig {
  const username = session?.user?.username

  // Build servarr items based on connected servarr applications
  const servarrItems: SidebarItem[] = []
  const normalizedConnected = connectedServarr.map((s) => s.toUpperCase())

  if (normalizedConnected.includes("SONARR")) {
    servarrItems.push({
      label: t("sonarr") || "Sonarr",
      dataKey: "servarr-sonarr",
      href: `/IRIS-list/servarr/sonarr`,
      icon: <IconDeviceTv className="size-4" />,
      children: [
        {
          label: t("series") || "Series",
          href: `/IRIS-list/servarr/sonarr`,
          icon: <IconDeviceTv className="size-4" />,
        },
        {
          label: t("manageSeries") || "Manage Series",
          href: `/IRIS-list/servarr/sonarr/manage`,
          icon: <IconListCheck className="size-4" />,
        },
        {
          label: t("activityQueue") || "Activity Queue",
          href: `/IRIS-list/servarr/sonarr/queue`,
          icon: <IconCloudDownload className="size-4" />,
        },
        {
          label: t("wanted") || "Wanted & Cutoff",
          href: `/IRIS-list/servarr/sonarr/wanted`,
          icon: <IconSearch className="size-4" />,
        },
        {
          label: t("history") || "History",
          href: `/IRIS-list/servarr/sonarr/history`,
          icon: <IconListDetails className="size-4" />,
        },
      ],
    })
  }

  if (normalizedConnected.includes("RADARR")) {
    servarrItems.push({
      label: t("radarr") || "Radarr",
      dataKey: "servarr-radarr",
      href: `/IRIS-list/servarr/radarr`,
      icon: <IconMovie className="size-4" />,
      children: [
        {
          label: t("movies") || "Movies",
          href: `/IRIS-list/servarr/radarr`,
          icon: <IconMovie className="size-4" />,
        },
        {
          label: t("manageMovies") || "Manage Movies",
          href: `/IRIS-list/servarr/radarr/manage`,
          icon: <IconListCheck className="size-4" />,
        },
        {
          label: t("activityQueue") || "Activity Queue",
          href: `/IRIS-list/servarr/radarr/queue`,
          icon: <IconCloudDownload className="size-4" />,
        },
        {
          label: t("wanted") || "Wanted & Cutoff",
          href: `/IRIS-list/servarr/radarr/wanted`,
          icon: <IconSearch className="size-4" />,
        },
        {
          label: t("history") || "History",
          href: `/IRIS-list/servarr/radarr/history`,
          icon: <IconListDetails className="size-4" />,
        },
      ],
    })
  }

  if (normalizedConnected.includes("READARR")) {
    servarrItems.push({
      label: t("readarr") || "Readarr",
      dataKey: "servarr-readarr",
      href: `/IRIS-list/servarr/readarr`,
      icon: <IconBook2 className="size-4" />,
    })
  }

  if (normalizedConnected.includes("LIDARR")) {
    servarrItems.push({
      label: t("lidarr") || "Lidarr",
      dataKey: "servarr-lidarr",
      href: `/IRIS-list/servarr/lidarr`,
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
          href: "/IRIS-list",
          icon: <IconHome className="size-5" />,
          position: 1,
        },
        {
          label: t("browse"),
          dataKey: "phone-browse",
          href: "/IRIS-list/browse",
          icon: <IconSearch className="size-5" />,
          position: 2,
          children: [
            {
              label: t("browse"),
              href: "/IRIS-list/browse",
              icon: <IconSearch className="size-4" />,
            },
            {
              label: t("rankings"),
              href: "/IRIS-list/rankings",
              icon: <IconTrophy className="size-4" />,
            },
            {
              label: t("discover"),
              href: "/IRIS-list/discover",
              icon: <IconSearch className="size-4" />,
            },
          ],
        },
        {
          label: t("calendar"),
          dataKey: "phone-calendar",
          href: "/IRIS-list/calendar",
          icon: <IconCalendar className="size-5" />,
          position: 3,
        },
        ...(username
          ? [
              {
                label: t("myLists"),
                dataKey: "phone-my-lists",
                icon: <IconList className="size-5" />,
                position: 4,
                children: [
                  {
                    label: t("anime"),
                    href: `/IRIS-list/lists/${username}/anime`,
                    icon: <IconTheater className="size-4" />,
                  },
                  {
                    label: t("manga"),
                    href: `/IRIS-list/lists/${username}/manga`,
                    icon: <IconBook className="size-4" />,
                  },
                  {
                    label: t("movie"),
                    href: `/IRIS-list/lists/${username}/movie`,
                    icon: <IconMovie className="size-4" />,
                  },
                  {
                    label: t("tv"),
                    href: `/IRIS-list/lists/${username}/tv`,
                    icon: <IconDeviceTv className="size-4" />,
                  },
                  {
                    label: t("game"),
                    href: `/IRIS-list/lists/${username}/game`,
                    icon: <IconDeviceGamepad className="size-4" />,
                  },
                  {
                    label: t("music"),
                    href: `/IRIS-list/lists/${username}/music`,
                    icon: <IconMusic className="size-4" />,
                  },
                  {
                    label: t("book"),
                    href: `/IRIS-list/lists/${username}/book`,
                    icon: <IconBook2 className="size-4" />,
                  },
                  {
                    label: t("other"),
                    href: `/IRIS-list/lists/${username}/other`,
                    icon: <IconList className="size-4" />,
                  },
                  {
                    label: t("customLists"),
                    href: `/IRIS-list/lists/${username}/custom-lists`,
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
          href: "/IRIS-list",
          icon: <IconHome className="size-4" />,
          position: 1,
        },
        {
          label: t("browse"),
          dataKey: "browse",
          href: "/IRIS-list/browse",
          icon: <IconSearch className="size-4" />,
          position: 2,
          children: [
            {
              label: t("rankings"),
              href: "/IRIS-list/rankings",
              icon: <IconTrophy className="size-4" />,
            },
            {
              label: t("discover"),
              href: "/IRIS-list/discover",
              icon: <IconSearch className="size-4" />,
            },
          ],
        },
        {
          label: t("calendar"),
          dataKey: "calendar",
          href: "/IRIS-list/calendar",
          icon: <IconCalendar className="size-4" />,
        },
      ],
    },

    ...(username
      ? [
          {
            section: t("library"),
            dataKey: "library",
            items: [
              {
                label: t("anime"),
                dataKey: "anime",
                href: `/IRIS-list/lists/${username}/anime`,
                icon: <IconTheater className="size-4" />,
              },
              {
                label: t("manga"),
                dataKey: "manga",
                href: `/IRIS-list/lists/${username}/manga`,
                icon: <IconBook className="size-4" />,
              },
              {
                label: t("movie"),
                dataKey: "movie",
                href: `/IRIS-list/lists/${username}/movie`,
                icon: <IconMovie className="size-4" />,
              },
              {
                label: t("tv"),
                dataKey: "tv",
                href: `/IRIS-list/lists/${username}/tv`,
                icon: <IconDeviceTv className="size-4" />,
              },
              {
                label: t("game"),
                dataKey: "game",
                href: `/IRIS-list/lists/${username}/game`,
                icon: <IconDeviceGamepad className="size-4" />,
              },
              {
                label: t("music"),
                dataKey: "music",
                href: `/IRIS-list/lists/${username}/music`,
                icon: <IconMusic className="size-4" />,
              },
              {
                label: t("book"),
                dataKey: "book",
                href: `/IRIS-list/lists/${username}/book`,
                icon: <IconBook2 className="size-4" />,
              },
              {
                label: t("other"),
                dataKey: "other",
                href: `/IRIS-list/lists/${username}/other`,
                icon: <IconList className="size-4" />,
              },
              {
                label: t("customLists"),
                dataKey: "custom-lists",
                href: `/IRIS-list/lists/${username}/custom-lists`,
                icon: <IconListDetails className="size-4" />,
              },
            ],
          },
        ]
      : []),

    ...(username && servarrItems.length > 0
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
  const username = session?.user?.username

  const [connectedServarr, setConnectedServarr] = useState<string[]>(
    () => initialConnectedServarr ?? cachedServarrProviders ?? []
  )

  useEffect(() => {
    if (!username) {
      cachedServarrProviders = null
      setConnectedServarr([])
      return
    }

    let isMounted = true

    async function fetchConnections() {
      try {
        const { data, error } = await elysia.connections.get({
          fetch: { credentials: "include" },
        })

        if (!error && data?.success && isMounted) {
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
      } catch {
        // Silently catch in sidebar
      }
    }

    fetchConnections()

    const handleUpdate = () => {
      fetchConnections()
    }
    window.addEventListener("iris-connections-changed", handleUpdate)
    window.addEventListener("iris-sidebar-changed", handleUpdate)

    return () => {
      isMounted = false
      window.removeEventListener("iris-connections-changed", handleUpdate)
      window.removeEventListener("iris-sidebar-changed", handleUpdate)
    }
  }, [username])

  return useMemo(
    () => getListSidebarConfig(session, t, connectedServarr),
    [session, t, connectedServarr]
  )
}
