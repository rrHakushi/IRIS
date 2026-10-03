import { hasPermission, type IRISBitFieldResolvable } from "@IRIS/permissions"
import type {
  SidebarConfig,
  SidebarSection,
  SidebarItem,
  SidebarItemChild,
  AppSidebarCustomization,
  CustomSidebarGroup,
  CustomSidebarItem,
} from "@/types/sidebar-config"

/**
 * Checks if the user has access to a resource based on its permissions.
 * If no permissions are required, it is public and accessible.
 */
function hasAccess(
  userPermissions: number[] | readonly number[] | null | undefined,
  required: IRISBitFieldResolvable | undefined
): boolean {
  if (!required) return true
  if (!userPermissions) return false
  return hasPermission(userPermissions, required, "any")
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
      const sectionPerm = section.permissions
      if (!hasAccess(userPermissions, sectionPerm)) {
        return { ...section, items: [] }
      }

      // 2. Filter items in this section
      const filteredItems = section.items
        .map((item): SidebarItem => {
          const itemPerm = item.permissions

          // If the item itself is not accessible, return item with empty children (will be filtered out)
          if (!hasAccess(userPermissions, itemPerm)) {
            return { ...item, children: [] } as any
          }

          // Filter children if present
          if (item.children && item.children.length > 0) {
            const filteredChildren = item.children.filter((child) => {
              const childPerm = child.permissions
              return hasAccess(userPermissions, childPerm)
            })
            return { ...item, children: filteredChildren }
          }

          return item
        })
        .filter((item) => {
          const itemPerm = item.permissions

          // Keep item if user has access to item itself
          const itemAccess = hasAccess(userPermissions, itemPerm)
          if (!itemAccess) return false

          // If item originally had children, at least one child must remain accessible
          const originalItem = section.items.find(
            (i) =>
              (i.dataKey && i.dataKey === item.dataKey) ||
              i.label === item.label
          )
          if (
            originalItem &&
            originalItem.children &&
            originalItem.children.length > 0
          ) {
            return !!(item.children && item.children.length > 0)
          }

          return true
        })

      return { ...section, items: filteredItems }
    })
    .filter((section) => {
      // Keep sections that have items left, or are special mobile views starting with #$
      return (
        section.items.length > 0 ||
        section.section?.toLowerCase().startsWith("#$")
      )
    })
}

/**
 * Returns a stable unique lookup key for an item or child.
 */
export function getItemKey(
  item: SidebarItem | SidebarItemChild | undefined | null
): string {
  if (!item) return ""
  return (
    item.dataKey ||
    item.href ||
    (item.component ? `label:${item.label}` : item.label)
  )
}

/**
 * Returns a stable unique lookup key for a sidebar section.
 */
export function getSectionKey(
  section: SidebarSection | undefined | null
): string {
  if (!section) return ""
  return section.dataKey || section.section
}

export interface ApplySidebarCustomizationOptions {
  includeHidden?: boolean
  preserveEmptySections?: boolean
}

/**
 * Applies user layout customization (reordering, custom groups, custom links,
 * hidden visibility, section relocation) onto a base SidebarConfig.
 *
 * Guarantees zero loss: Any new sections or items introduced by code updates
 * are automatically appended in their original places so new features are never missed.
 */
export function applySidebarCustomization(
  baseConfig: SidebarConfig,
  customization?: AppSidebarCustomization,
  allAppConfigs?: Array<{ appId: string; appName: string; config: SidebarConfig }>,
  options?: ApplySidebarCustomizationOptions
): SidebarConfig {
  if (!baseConfig || baseConfig.length === 0) return []

  const includeHidden = options?.includeHidden ?? false

  // 1. Build a registry of all available items across all apps for cross-app shortcut resolution
  const shortcutMap = new Map<string, SidebarItem>()
  const registerItem = (it: SidebarItem) => {
    const k = getItemKey(it)
    if (k && !shortcutMap.has(k)) {
      shortcutMap.set(k, it)
    }
  }

  if (allAppConfigs) {
    allAppConfigs.forEach((app) => {
      app.config.forEach((sec) => {
        sec.items.forEach((it) => {
          registerItem(it)
          if (it.children) {
            it.children.forEach((ch) => {
              const chKey = getItemKey(ch)
              if (chKey && !shortcutMap.has(chKey)) {
                shortcutMap.set(chKey, {
                  label: ch.label,
                  href: ch.href,
                  icon: ch.icon,
                  badge: ch.badge,
                  dataKey: chKey,
                  onClick: ch.onClick,
                  component: ch.component,
                })
              }
            })
          }
        })
      })
    })
  }

  baseConfig.forEach((sec) => {
    sec.items.forEach((it) => {
      registerItem(it)
      if (it.children) {
        it.children.forEach((ch) => {
          const chKey = getItemKey(ch)
          if (chKey && !shortcutMap.has(chKey)) {
            shortcutMap.set(chKey, {
              label: ch.label,
              href: ch.href,
              icon: ch.icon,
              badge: ch.badge,
              dataKey: chKey,
              onClick: ch.onClick,
              component: ch.component,
            })
          }
        })
      }
    })
  })

  // 2. Clone base sections and items
  let sections: SidebarSection[] = baseConfig.map((sec) => ({
    ...sec,
    items: [...sec.items],
  }))

  if (!customization) {
    return sections
  }

  const {
    sectionOrder = [],
    hiddenSections = [],
    itemOrder = {},
    hiddenItems = [],
    itemOverrides = {},
    childrenOrder = {},
    hiddenChildren = [],
    customGroups = [],
    customLinks = [],
  } = customization

  // Dynamic import of renderDockGroupIcon helper
  const { renderDockGroupIcon } = require("@/config/dock-group-icons")

  // 3. Process Custom Groups
  const groupedItemKeys = new Set<string>()
  customGroups.forEach((group: CustomSidebarGroup) => {
    group.itemKeys.forEach((k) => groupedItemKeys.add(k))
  })

  // Remove items that are consumed by custom groups from base sections
  sections.forEach((sec) => {
    sec.items = sec.items.filter((it) => !groupedItemKeys.has(getItemKey(it)))
  })

  customGroups.forEach((group: CustomSidebarGroup) => {
    const groupItems: SidebarItem[] = []

    // Resolve assigned shortcuts
    group.itemKeys.forEach((key: string) => {
      if (!includeHidden && hiddenItems.includes(key)) return
      const found = shortcutMap.get(key)
      if (found) {
        groupItems.push({ ...found })
      }
    })

    // Resolve custom links inside this group
    if (group.customLinks && Array.isArray(group.customLinks)) {
      group.customLinks.forEach((link: CustomSidebarItem) => {
        groupItems.push({
          label: link.label,
          href: link.href,
          icon: renderDockGroupIcon(link.icon || "pin", "size-4"),
          dataKey: `link:${link.id}`,
        })
      })
    }

    if (group.type === "section") {
      // Custom Section: inject as top-level SidebarSection
      sections.push({
        section: group.label,
        dataKey: `group-sec:${group.id}`,
        items: groupItems,
      })
    } else {
      // Custom Folder (Arrow Menu like Browse):
      // The first item in itemKeys is the primary clickable item on the left (with its label, icon, href).
      // The remaining items become the arrow menu children in the popover on the right!
      const targetSecKey = group.targetSectionKey
      let targetSection = targetSecKey
        ? sections.find((s) => getSectionKey(s) === targetSecKey)
        : undefined

      const primaryItem = groupItems[0]
      if (primaryItem) {
        const remainingItems = groupItems.slice(1)
        const childKeysSeen = new Set<string>()
        const folderChildren: SidebarItemChild[] = []

        remainingItems.forEach((gi) => {
          const k = getItemKey(gi)
          if (!childKeysSeen.has(k)) {
            childKeysSeen.add(k)
            folderChildren.push({
              label: gi.label,
              href: gi.href,
              icon: gi.icon,
              badge: gi.badge,
              dataKey: k,
              onClick: gi.onClick,
              component: gi.component,
            })
          }
        })

        if (remainingItems.length === 0 && primaryItem.children) {
          primaryItem.children.forEach((ch) => {
            const k = getItemKey(ch)
            if (!childKeysSeen.has(k) && (!customization.hiddenItems || !customization.hiddenItems.includes(k))) {
              childKeysSeen.add(k)
              folderChildren.push(ch)
            }
          })
        }

        const folderItem: SidebarItem = {
          ...primaryItem,
          label: primaryItem.label,
          href: primaryItem.href,
          icon: primaryItem.icon,
          dataKey: `group-folder:${group.id}`,
          children: folderChildren,
        }

        if (targetSection) {
          targetSection.items.push(folderItem)
        } else {
          // If no target section exists, inject as a dedicated unnamed section with section: ""
          // so it renders directly as a split pill (like Browse) in horizontal navbar!
          sections.push({
            section: "",
            dataKey: `group-sec:${group.id}`,
            items: [folderItem],
          })
        }
      }
    }
  })

  // 4. Process Standalone Custom Links
  customLinks.forEach((link: CustomSidebarItem) => {
    const targetSection = sections[0]
    if (targetSection) {
      targetSection.items.push({
        label: link.label,
        href: link.href,
        icon: renderDockGroupIcon(link.icon || "pin", "size-4"),
        dataKey: `link:${link.id}`,
      })
    }
  })

  // 5. Handle Item Overrides (relocating items across sections or adding from inventory/cross-app)
  if (itemOverrides && Object.keys(itemOverrides).length > 0) {
    const movedItems: { item: SidebarItem; targetSecKey: string }[] = []

    sections.forEach((sec) => {
      const remainingItems: SidebarItem[] = []
      sec.items.forEach((it) => {
        const itKey = getItemKey(it)
        const override = itemOverrides[itKey]
        if (override?.sectionKey && override.sectionKey !== getSectionKey(sec)) {
          movedItems.push({ item: it, targetSecKey: override.sectionKey })
        } else {
          remainingItems.push(it)
        }
      })
      sec.items = remainingItems
    })

    // Also include items from itemOverrides that weren't in base sections (e.g. from inventory/allAppConfigs)
    Object.entries(itemOverrides).forEach(([itKey, override]) => {
      if (!override?.sectionKey) return
      if (!includeHidden && hiddenItems.includes(itKey)) return
      const alreadyMoved = movedItems.some((m) => getItemKey(m.item) === itKey)
      const alreadyInDest = sections.some(
        (s) =>
          getSectionKey(s) === override.sectionKey &&
          s.items.some((it) => getItemKey(it) === itKey)
      )
      if (!alreadyMoved && !alreadyInDest) {
        const shortcut = shortcutMap.get(itKey)
        if (shortcut) {
          movedItems.push({
            item: { ...shortcut },
            targetSecKey: override.sectionKey,
          })
        }
      }
    })

    movedItems.forEach(({ item, targetSecKey }) => {
      const dest = sections.find((s) => getSectionKey(s) === targetSecKey)
      if (dest) {
        const itKey = getItemKey(item)
        if (!dest.items.some((existing) => getItemKey(existing) === itKey)) {
          dest.items.push(item)
        }
      } else {
        // Fallback: put back into first section
        if (sections[0]) {
          const itKey = getItemKey(item)
          if (!sections[0].items.some((existing) => getItemKey(existing) === itKey)) {
            sections[0].items.push(item)
          }
        }
      }
    })
  }

  // 6. Filter Hidden Elements (unless includeHidden is enabled)
  if (!includeHidden) {
    sections = sections.filter((sec) => {
      const secKey = getSectionKey(sec)
      if (hiddenSections.includes(secKey)) return false

      // Filter hidden items
      sec.items = sec.items.filter((it) => {
        const itKey = getItemKey(it)
        if (hiddenItems.includes(itKey)) return false

        // Filter hidden children
        if (it.children) {
          it.children = it.children.filter((ch) => {
            const chKey = getItemKey(ch)
            return !hiddenChildren.includes(chKey)
          })
        }
        return true
      })

      // Preserve special mobile view sections starting with #$, sections with items, preserveEmptySections option, or custom sections
      if (options?.preserveEmptySections || secKey.startsWith("group-sec:")) return true
      return sec.items.length > 0 || sec.section?.toLowerCase().startsWith("#$")
    })
  }

  // 7. Order Sections according to sectionOrder (append any unlisted sections)
  if (sectionOrder.length > 0) {
    const secMap = new Map<string, SidebarSection>()
    sections.forEach((sec) => secMap.set(getSectionKey(sec), sec))

    const orderedSections: SidebarSection[] = []
    const seenSecKeys = new Set<string>()

    sectionOrder.forEach((key: string) => {
      const sec = secMap.get(key)
      if (sec) {
        orderedSections.push(sec)
        seenSecKeys.add(key)
      }
    })

    // Append unlisted sections (auto-discovery for new updates)
    sections.forEach((sec) => {
      const key = getSectionKey(sec)
      if (!seenSecKeys.has(key)) {
        orderedSections.push(sec)
      }
    })

    sections = orderedSections
  }

  // 8. Order Items and Children within each Section
  sections.forEach((sec) => {
    const secKey = getSectionKey(sec)
    const customItemKeys = itemOrder[secKey]

    if (customItemKeys && customItemKeys.length > 0) {
      const itMap = new Map<string, SidebarItem>()
      sec.items.forEach((it) => {
        itMap.set(getItemKey(it), it)
        if (it.dataKey?.startsWith("group-folder:")) {
          if (it.href) itMap.set(it.href, it)
          if (it.label) itMap.set(it.label, it)
          const gId = it.dataKey.replace("group-folder:", "")
          const grp = customGroups.find((g) => g.id === gId)
          if (grp) {
            grp.itemKeys.forEach((k) => itMap.set(k, it))
          }
        }
      })

      const orderedItems: SidebarItem[] = []
      const seenItemKeys = new Set<string>()

      customItemKeys.forEach((k: string) => {
        if (!includeHidden && hiddenItems.includes(k)) return
        let it = itMap.get(k)
        if (!it && shortcutMap.has(k)) {
          it = { ...shortcutMap.get(k)! }
        }
        if (it) {
          const itemKey = getItemKey(it)
          if (!seenItemKeys.has(itemKey)) {
            orderedItems.push(it)
            seenItemKeys.add(itemKey)
          }
        }
      })

      // Append unlisted items (auto-discovery)
      sec.items.forEach((it) => {
        const k = getItemKey(it)
        // If this item was explicitly moved to another section via itemOverrides, do not append it here!
        const override = itemOverrides[k]
        if (override?.sectionKey && override.sectionKey !== secKey) {
          return
        }
        if (!seenItemKeys.has(k)) {
          orderedItems.push(it)
        }
      })

      sec.items = orderedItems
    }

    // Order children for each item
    sec.items.forEach((it) => {
      if (it.children && it.children.length > 0) {
        const itKey = getItemKey(it)
        const customChildKeys = childrenOrder[itKey]

        if (customChildKeys && customChildKeys.length > 0) {
          const chMap = new Map<string, SidebarItemChild>()
          it.children.forEach((ch) => chMap.set(getItemKey(ch), ch))

          const orderedChildren: SidebarItemChild[] = []
          const seenChildKeys = new Set<string>()

          customChildKeys.forEach((ck: string) => {
            const ch = chMap.get(ck)
            if (ch) {
              orderedChildren.push(ch)
              seenChildKeys.add(ck)
            }
          })

          it.children.forEach((ch) => {
            const ck = getItemKey(ch)
            if (!seenChildKeys.has(ck)) {
              orderedChildren.push(ch)
            }
          })

          it.children = orderedChildren
        }
      }
    })
  })

  return sections
}

