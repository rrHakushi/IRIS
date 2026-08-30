export interface GameItem {
  id: string;
  externalId: string;
  name: string;
  iconUrl?: string;
  logoUrl?: string;
  headerUrl?: string;
  playtimeMinutes?: number;
  playtime2WeeksMinutes?: number;
  lastPlayedAt?: Date | string | null;
  achievements?: {
    unlocked: number;
    total: number;
  };
}

export interface GamingProfile {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  gameCount?: number;
  statusMessage?: string;
  isOnline?: boolean;
}
