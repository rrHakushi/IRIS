import type { ReactNode } from "react";
import type { IRISBitFieldResolvable } from "@IRIS/permissions";

export type Permissions = IRISBitFieldResolvable;

/**
 * Valid sidebar positions / orientations.
 * "left" and "right" are active and mirrored.
 * "top" and "bottom" are architected for future horizontal modes.
 */
export type SidebarPosition = "left" | "right" | "top" | "bottom";

export interface SidebarSection {
  /**
   * Section heading. If starts with "#$" (e.g. "#$Phone"),
   * it designates items for mobile dock resolution.
   */
  section: string;

  /**
   * Stable, language-agnostic key used for programmatic lookups via getSection().
   */
  dataKey?: string;

  /**
   * Items contained within this section.
   */
  items: SidebarItem[];

  /**
   * RBAC permission check required to view this section.
   */
  permissions?: Permissions;
}

export type SidebarItem = {
  label: string;
  subtitle?: string;

  /**
   * Stable, language-agnostic key for programmatic lookups.
   */
  dataKey?: string;

  icon?: ReactNode;
  badge?: string | number;

  /**
   * Sort position: positive at top (1, 2, 3...), undefined in middle (0), negative in footer (-1, -2...).
   */
  position?: number;

  /**
   * RBAC permission check required to view this item.
   */
  permissions?: Permissions;

  children?: SidebarItemChild[];
  onClick?: () => void;
  component?: ReactNode;
  href?: string;
  preventRedirect?: boolean;
};

export type SidebarItemChild = {
  label: string;
  subtitle?: string;

  /**
   * Stable, language-agnostic key for programmatic lookups.
   */
  dataKey?: string;

  icon?: ReactNode;
  badge?: string | number;
  position?: number;
  permissions?: Permissions;
  onClick?: () => void;
  component?: ReactNode;
  href?: string;
  preventRedirect?: boolean;
};

export type SidebarConfig = SidebarSection[];

export type DockPositions = Record<string, string | null>;

export interface DockItemData {
  label: string;
  icon: ReactNode;
  href?: string;
  isActive?: boolean;
  onClick?: () => void;
  component?: ReactNode;
  children?: SidebarItemChild[];
}
