import React from "react";
import type { SidebarConfig } from "@/types/sidebar-config";
import { IRISFlags } from "@IRIS/permissions";
import {
  IconDashboard,
  IconChartBar,
  IconActivity,
  IconShield,
  IconKey,
  IconFileText,
  IconApps,
  IconPuzzle,
  IconSettings,
  IconUsers,
  IconDatabase,
  IconBell,
} from "@tabler/icons-react";

export function getDefaultSidebarConfig(): SidebarConfig {
  return [
    {
      section: "Overview",
      dataKey: "overview",
      items: [
        {
          label: "Dashboard",
          dataKey: "dashboard",
          href: "/",
          icon: <IconDashboard className="size-4" />,
          position: 1,
        },
        {
          label: "Analytics",
          dataKey: "analytics",
          href: "/analytics",
          icon: <IconChartBar className="size-4" />,
          badge: "Live",
          position: 2,
        },
        {
          label: "Activity",
          dataKey: "activity",
          href: "/activity",
          icon: <IconActivity className="size-4" />,
        },
      ],
    },
    {
      section: "Modules",
      dataKey: "modules",
      items: [
        {
          label: "Applications",
          dataKey: "applications",
          icon: <IconApps className="size-4" />,
          position: 3,
          children: [
            {
              label: "Authentication",
              dataKey: "app-auth",
              href: "/auth/login",
              icon: <IconKey className="size-4" />,
            },
            {
              label: "Database Studio",
              dataKey: "app-db",
              href: "/database",
              icon: <IconDatabase className="size-4" />,
            },
            {
              label: "Integrations",
              dataKey: "app-integrations",
              href: "/integrations",
              icon: <IconPuzzle className="size-4" />,
              badge: "3",
            },
          ],
        },
        {
          label: "Notifications",
          dataKey: "notifications",
          href: "/notifications",
          icon: <IconBell className="size-4" />,
          badge: "2",
        },
      ],
    },
    {
      section: "Administration",
      dataKey: "administration",
      permissions: IRISFlags.ADMINISTRATOR,
      items: [
        {
          label: "Access Control",
          dataKey: "access-control",
          icon: <IconShield className="size-4" />,
          permissions: IRISFlags.ADMINISTRATOR,
          children: [
            {
              label: "User Management",
              dataKey: "admin-users",
              href: "/admin/users",
              icon: <IconUsers className="size-4" />,
              permissions: IRISFlags.ADMINISTRATOR,
            },
            {
              label: "Audit Logs",
              dataKey: "admin-audit",
              href: "/admin/audit",
              icon: <IconFileText className="size-4" />,
              permissions: IRISFlags.ADMINISTRATOR,
            },
          ],
        },
        {
          label: "System Settings",
          dataKey: "system-settings",
          href: "/settings",
          icon: <IconSettings className="size-4" />,
          position: 4,
        },
      ],
    },
    {
      section: "phone",
      dataKey: "phone",
      items: [
        {
          label: "Dashboard",
          dataKey: "phone-dashboard",
          href: "/",
          icon: <IconDashboard className="size-5" />,
          position: 1,
        },
        {
          label: "Analytics",
          dataKey: "phone-analytics",
          href: "/analytics",
          icon: <IconChartBar className="size-5" />,
          position: 2,
        },
        {
          label: "Apps",
          dataKey: "phone-apps",
          href: "/applications",
          icon: <IconApps className="size-5" />,
          position: 3,
        },
        {
          label: "Settings",
          dataKey: "phone-settings",
          href: "/settings",
          icon: <IconSettings className="size-5" />,
          position: 4,
        },
      ],
    },
  ];
}
