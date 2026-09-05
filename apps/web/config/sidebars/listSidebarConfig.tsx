import React, { useMemo } from "react"
import type { SidebarConfig } from "@/types/sidebar-config"
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
} from "@tabler/icons-react"
import { Session } from "next-auth"

export function getListSidebarConfig(
  session: Session | null,
  t: (key: string) => string
): SidebarConfig {
  const username = session?.user?.username
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
                    label: t("watchlists"),
                    href: `/IRIS-list/lists/${username}/watchlists`,
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
                label: t("watchlists"),
                dataKey: "watchlists",
                href: `/IRIS-list/lists/${username}/watchlists`,
                icon: <IconListDetails className="size-4" />,
              },
            ],
          },
        ]
      : []),
  ]
}

export function useListSidebarConfig(session: Session | null): SidebarConfig {
  const t = useTranslations("navigation.listSidebar")
  const username = session?.user?.username
  return useMemo(() => getListSidebarConfig(session, t), [username, t])
}
