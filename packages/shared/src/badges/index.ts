import badgesData from "./badges.json";

export interface IrisBadge {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: "achievement" | "role" | "special" | "media";
  hidden: boolean;
}

export const BADGES: readonly IrisBadge[] = badgesData as IrisBadge[];

export function getBadgeById(id: number): IrisBadge | undefined {
  return BADGES.find((b) => b.id === id);
}

export function getAllBadges(): readonly IrisBadge[] {
  return BADGES;
}
