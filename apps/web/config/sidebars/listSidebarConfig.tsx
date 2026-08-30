import React, { useMemo } from "react";
import type { SidebarConfig } from "@/types/sidebar-config";
import { useTranslations } from "next-intl";
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
} from "@tabler/icons-react";
import { Session } from "next-auth";

export function getListSidebarConfig(
  session: Session | null,
  t: (key: string) => string
): SidebarConfig {
  const username = session?.user?.username;
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
                  label: t("animeList"),
                  href: `/IRIS-list/lists/${username}/anime`,
                },
                {
                  label: t("mangaList"),
                  href: `/IRIS-list/lists/${username}/manga`,
                },
                {
                  label: t("movieList"),
                  href: `/IRIS-list/lists/${username}/movie`,
                },
                {
                  label: t("tvList"),
                  href: `/IRIS-list/lists/${username}/tv`,
                },
                {
                  label: t("gameList"),
                  href: `/IRIS-list/lists/${username}/game`,
                },
                {
                  label: t("musicList"),
                  href: `/IRIS-list/lists/${username}/music`,
                },
                {
                  label: t("bookList"),
                  href: `/IRIS-list/lists/${username}/book`,
                },
                {
                  label: t("otherLists"),
                  href: `/IRIS-list/lists/${username}/other`,
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
              label: t("animeList"),
              dataKey: "anime-list",
              href: `/IRIS-list/lists/${username}/anime`,
              icon: <IconTheater className="size-4" />,
            },
            {
              label: t("mangaList"),
              dataKey: "manga-list",
              href: `/IRIS-list/lists/${username}/manga`,
              icon: <IconBook className="size-4" />,
            },
            {
              label: t("movieList"),
              dataKey: "movie-list",
              href: `/IRIS-list/lists/${username}/movie`,
              icon: <IconMovie className="size-4" />,
            },
            {
              label: t("tvList"),
              dataKey: "tv-list",
              href: `/IRIS-list/lists/${username}/tv`,
              icon: <IconDeviceTv className="size-4" />,
            },
            {
              label: t("gameList"),
              dataKey: "game-list",
              href: `/IRIS-list/lists/${username}/game`,
              icon: <IconDeviceGamepad className="size-4" />,
            },
            {
              label: t("musicList"),
              dataKey: "music-list",
              href: `/IRIS-list/lists/${username}/music`,
              icon: <IconMusic className="size-4" />,
            },
            {
              label: t("bookList"),
              dataKey: "book-list",
              href: `/IRIS-list/lists/${username}/book`,
              icon: <IconBook2 className="size-4" />,
            },
            {
              label: t("otherLists"),
              dataKey: "other-lists",
              href: `/IRIS-list/lists/${username}/other`,
              icon: <IconList className="size-4" />,
            },
          ],
        },
      ]
      : []),
  ];
}

export function useListSidebarConfig(session: Session | null): SidebarConfig {
  const t = useTranslations("navigation.listSidebar");
  const username = session?.user?.username;
  return useMemo(() => getListSidebarConfig(session, t), [username, t]);
}