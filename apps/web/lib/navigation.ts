import { hasPermission, type IRISBitFieldResolvable } from "@IRIS/permissions";
import type { SidebarConfig, SidebarSection, SidebarItem } from "@/types/sidebar-config";

/**
 * Checks if the user has access to a resource based on its permissions.
 * If no permissions are required, it is public and accessible.
 */
function hasAccess(
  userPermissions: number[] | readonly number[] | null | undefined,
  required: IRISBitFieldResolvable | undefined
): boolean {
  if (!required) return true;
  if (!userPermissions) return false;
  return hasPermission(userPermissions, required, "any");
}

/**
 * Filters a SidebarConfig recursively based on user permissions.
 * Sections and items automatically inherit visibility from their children.
 * Special mobile dock sections starting with "#$" are preserved.
 */
export function filterSidebarConfig(
  config: SidebarConfig,
  userPermissions: number[] | readonly number[] | null | undefined
): SidebarConfig {
  return config
    .map((section): SidebarSection => {
      // 1. Check section permission
      const sectionPerm = section.permissions;
      if (!hasAccess(userPermissions, sectionPerm)) {
        return { ...section, items: [] };
      }

      // 2. Filter items in this section
      const filteredItems = section.items
        .map((item): SidebarItem => {
          const itemPerm = item.permissions;

          // If the item itself is not accessible, return item with empty children (will be filtered out)
          if (!hasAccess(userPermissions, itemPerm)) {
            return { ...item, children: [] } as any;
          }

          // Filter children if present
          if (item.children && item.children.length > 0) {
            const filteredChildren = item.children.filter((child) => {
              const childPerm = child.permissions;
              return hasAccess(userPermissions, childPerm);
            });
            return { ...item, children: filteredChildren };
          }

          return item;
        })
        .filter((item) => {
          const itemPerm = item.permissions;

          // Keep item if user has access to item itself
          const itemAccess = hasAccess(userPermissions, itemPerm);
          if (!itemAccess) return false;

          // If item originally had children, at least one child must remain accessible
          const originalItem = section.items.find(
            (i) => (i.dataKey && i.dataKey === item.dataKey) || i.label === item.label
          );
          if (originalItem && originalItem.children && originalItem.children.length > 0) {
            return !!(item.children && item.children.length > 0);
          }

          return true;
        });

      return { ...section, items: filteredItems };
    })
    .filter((section) => {
      // Keep sections that have items left, or are special mobile views starting with #$
      return section.items.length > 0 || section.section?.toLowerCase().startsWith("#$");
    });
}
