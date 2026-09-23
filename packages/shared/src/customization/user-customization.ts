export type DisplayNameEffectType =
  | "solid"
  | "gradient"
  | "neon"
  | "toon"
  | "pop"
  | "gummy"
  | "prism"
  | "glitch"
  | "chrome"
  | "flame"
  | "celestial";

export interface DisplayNameStyle {
  font?: string;
  effect?: DisplayNameEffectType | string;
  color?: string;
  color2?: string;
  colors?: string[]; // Array of 2 to 8 colors for prism or multi-stop gradients
  positions?: number[]; // Array of 2 to 8 stop positions (0 to 100%)
}

export interface SocialLink {
  platform?: string; // Optional legacy identifier
  url: string;
  label?: string;
}

export interface PinnedSpotlight {
  title?: string;
  subtitle?: string;
  mediaType?: string;
  mediaId?: number;
  customNote?: string;
  imageUrl?: string;
  link?: string;
}

export interface ProfilePrivacySettings {
  showBirthday?: "public" | "friends" | "private";
  showLocation?: "public" | "friends" | "private";
  allowComments?: "public" | "friends" | "disabled";
}

export interface UserProfileCustomization {
  displayName?: string;
  displayNameStyle?: DisplayNameStyle;
  pronouns?: string;
  statusText?: string;
  bio?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerOverlayUrl?: string | null; // URL of uploaded transparent banner texture/overlay
  nameplateUrl?: string | null;
  sidebarBannerUrl?: string | null; // Backwards-compatible alias for nameplateUrl
  avatarFrame?: string | null; // URL of uploaded PNG/SVG transparent frame overlay
  socialLinks?: SocialLink[];
  accentColor?: string | null;
  pinnedSpotlight?: PinnedSpotlight | null;
  showcaseBadgeIds?: number[]; // Up to 10 showcased badge IDs
  birthday?: string | null;
  showBirthdayYear?: boolean;
  country?: string | null;
  region?: string | null;
  location?: string | null;
  timezone?: string | null;
  website?: string | null;
  privacy?: ProfilePrivacySettings;
}

export type MediaTitleLanguage = "primary" | "secondary" | "native";

export interface UserMediaPreferences {
  title?: MediaTitleLanguage;
}

export interface UserPreferencesCustomization {
  media?: UserMediaPreferences;
}

export type DockPositions = Record<string, string | null>;

export interface CustomDockGroup {
  id: string;
  label: string;
  icon: string;
  itemKeys: string[];
}

export interface UserDockCustomization {
  positions?: DockPositions;
  customGroups?: CustomDockGroup[];
  [key: string]: unknown;
}

export interface UserBookmark {
  id: string;
  title: string;
  url: string;
  icon?: string;
  color?: string;
  pinned?: boolean;
  appId?: string;
  group?: string;
  order?: number;
  createdAt?: string;
}

export interface UserCustomization {
  profile?: UserProfileCustomization;
  appearance?: Record<string, unknown>;
  sidebar?: Record<string, unknown>;
  dock?: UserDockCustomization;
  preferences?: UserPreferencesCustomization;
  bookmarks?: UserBookmark[];
  [key: string]: unknown;
}

export function getBookmarksCustomization(customization?: unknown): UserBookmark[] {
  if (!customization || typeof customization !== "object") {
    return [];
  }
  const bookmarks = (customization as any)?.bookmarks;
  if (!Array.isArray(bookmarks)) {
    return [];
  }
  return bookmarks
    .filter(
      (b): b is UserBookmark =>
        b && typeof b === "object" && typeof b.id === "string" && typeof b.title === "string" && typeof b.url === "string"
    )
    .map((b) => ({
      id: b.id,
      title: b.title,
      url: b.url,
      icon: typeof b.icon === "string" ? b.icon : undefined,
      color: typeof b.color === "string" ? b.color : undefined,
      pinned: Boolean(b.pinned),
      createdAt: typeof b.createdAt === "string" ? b.createdAt : undefined,
    }));
}

export function setBookmarksCustomization(
  existingCustomization: unknown,
  bookmarks: UserBookmark[]
): Record<string, unknown> {
  const current =
    existingCustomization && typeof existingCustomization === "object"
      ? { ...(existingCustomization as Record<string, unknown>) }
      : {};

  return {
    ...current,
    bookmarks,
  };
}

export function getMediaPreferences(customization?: unknown): UserMediaPreferences {
  if (!customization || typeof customization !== "object") {
    return { title: "primary" };
  }
  const media = (customization as any)?.preferences?.media;
  const title = media?.title;
  if (title === "secondary" || title === "native" || title === "primary") {
    return { title };
  }
  return { title: "primary" };
}

export interface FontPreset {
  id: string;
  name: string;
  family: string;
  description: string;
}

export interface TextEffectPreset {
  id: DisplayNameEffectType;
  name: string;
  description: string;
  colorCount: number; // 1, 2, or 5
  previewColors: string[];
}

export interface ColorPreset {
  id: string;
  name: string;
  value: string;
}

export interface GradientPreset {
  id: string;
  name: string;
  color1: string;
  color2: string;
  colors?: string[];
  positions?: number[];
}

export interface PrismPreset {
  id: string;
  name: string;
  colors: string[];
  positions?: number[];
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const FONT_PRESETS: readonly FontPreset[] = [
  {
    id: "default",
    name: "Modern Sans (Default)",
    family: "var(--font-sans, inherit)",
    description: "Clean, balanced modern sans-serif",
  },
  {
    id: "inter",
    name: "Inter",
    family: "'Inter', sans-serif",
    description: "Crisp interface typography",
  },
  {
    id: "mono",
    name: "JetBrains Mono",
    family: "'JetBrains Mono', monospace",
    description: "High-tech terminal typeface",
  },
  {
    id: "serif",
    name: "Playfair Display",
    family: "'Playfair Display', Georgia, serif",
    description: "Classic, editorial elegance",
  },
  {
    id: "orbitron",
    name: "Orbitron",
    family: "'Orbitron', sans-serif",
    description: "Futuristic sci-fi geometry",
  },
  {
    id: "cinzel",
    name: "Cinzel Decorative",
    family: "'Cinzel', serif",
    description: "Regal fantasy styling",
  },
  {
    id: "script",
    name: "Dancing Script",
    family: "'Dancing Script', cursive",
    description: "Flowing handwritten script",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    family: "'Blender Pro', 'Orbitron', monospace, sans-serif",
    description: "Edgy cybernetic interface geometry",
  },
  {
    id: "pixel",
    name: "Retro Pixel",
    family: "'Press Start 2P', monospace",
    description: "8-bit nostalgic arcade typography",
  },
  {
    id: "blackletter",
    name: "Gothic Blackletter",
    family: "'UnifrakturMaguntia', 'Cinzel', serif",
    description: "Dark medieval gothic calligraphy",
  },
] as const;

export const TEXT_EFFECT_PRESETS: readonly TextEffectPreset[] = [
  {
    id: "solid",
    name: "Solid",
    description: "Clean single accent color",
    colorCount: 1,
    previewColors: ["#ffffff"],
  },
  {
    id: "gradient",
    name: "Gradient",
    description: "Smooth 2-color linear transition",
    colorCount: 2,
    previewColors: ["#818cf8", "#c084fc"],
  },
  {
    id: "neon",
    name: "Neon",
    description: "Vibrant pulsating luminescence",
    colorCount: 1,
    previewColors: ["#d946ef"],
  },
  {
    id: "toon",
    name: "Toon",
    description: "Cel-shaded comic book outline",
    colorCount: 1,
    previewColors: ["#ec4899"],
  },
  {
    id: "pop",
    name: "Pop",
    description: "Layered 3D extruded pop style",
    colorCount: 2,
    previewColors: ["#34d399", "#059669"],
  },
  {
    id: "gummy",
    name: "Gummy",
    description: "Glossy candy jelly bubble",
    colorCount: 1,
    previewColors: ["#f472b6"],
  },
  {
    id: "prism",
    name: "Prism",
    description: "Full 5-color rainbow spectrum",
    colorCount: 5,
    previewColors: ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
  },
  {
    id: "glitch",
    name: "Cyber Glitch",
    description: "Chromatic aberration cyan-red distortion",
    colorCount: 2,
    previewColors: ["#06b6d4", "#ef4444"],
  },
  {
    id: "chrome",
    name: "Liquid Chrome",
    description: "Specular metallic high-sheen reflection",
    colorCount: 2,
    previewColors: ["#e2e8f0", "#64748b"],
  },
  {
    id: "flame",
    name: "Solar Flame",
    description: "Blazing thermal magma glow",
    colorCount: 2,
    previewColors: ["#f59e0b", "#ef4444"],
  },
  {
    id: "celestial",
    name: "Celestial Star",
    description: "Cosmic starlight shimmer with mystic aura",
    colorCount: 2,
    previewColors: ["#38bdf8", "#ec4899"],
  },
] as const;

export const COLOR_PRESETS: readonly ColorPreset[] = [
  { id: "white", name: "Pure White", value: "#ffffff" },
  { id: "crimson", name: "Crimson Red", value: "#ef4444" },
  { id: "coral", name: "Sunset Orange", value: "#f97316" },
  { id: "amber", name: "Solar Amber", value: "#f59e0b" },
  { id: "emerald", name: "Neon Emerald", value: "#10b981" },
  { id: "cyan", name: "Electric Cyan", value: "#06b6d4" },
  { id: "sky", name: "Celeste Sky", value: "#38bdf8" },
  { id: "indigo", name: "Deep Indigo", value: "#6366f1" },
  { id: "violet", name: "Mystic Violet", value: "#8b5cf6" },
  { id: "fuchsia", name: "Neon Fuchsia", value: "#d946ef" },
  { id: "pink", name: "Hot Pink", value: "#ec4899" },
  { id: "rose", name: "Rose Quartz", value: "#f43f5e" },
  // Expanded vibrant aesthetic palette
  { id: "mint", name: "Cyber Mint", value: "#10e599" },
  { id: "gold", name: "Imperial Gold", value: "#eab308" },
  { id: "lime", name: "Neon Lime", value: "#84cc16" },
  { id: "lavender", name: "Lavender Mist", value: "#c084fc" },
  { id: "sakura", name: "Sakura Blossom", value: "#fbcfe8" },
  { id: "velvet", name: "Royal Velvet", value: "#7c3aed" },
  { id: "midnight", name: "Midnight Blue", value: "#3b82f6" },
  { id: "teal", name: "Teal Aura", value: "#14b8a6" },
  { id: "ruby", name: "Blood Moon Ruby", value: "#dc2626" },
  { id: "peach", name: "Sunset Peach", value: "#fb923c" },
  { id: "smoke", name: "Silver Smoke", value: "#94a3b8" },
  { id: "obsidian", name: "Obsidian", value: "#18181b" },
] as const;

export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  { id: "cyber", name: "Cyberpunk", color1: "#818cf8", color2: "#c084fc", colors: ["#818cf8", "#c084fc"] },
  { id: "sunset", name: "Sunset", color1: "#f97316", color2: "#ec4899", colors: ["#f97316", "#ec4899"] },
  { id: "ocean", name: "Ocean Wave", color1: "#06b6d4", color2: "#3b82f6", colors: ["#06b6d4", "#3b82f6"] },
  { id: "aurora", name: "Aurora", color1: "#10b981", color2: "#06b6d4", colors: ["#10b981", "#06b6d4"] },
  { id: "fire", name: "Wildfire", color1: "#f59e0b", color2: "#ef4444", colors: ["#f59e0b", "#ef4444"] },
  { id: "galaxy", name: "Galaxy", color1: "#a855f7", color2: "#38bdf8", colors: ["#a855f7", "#38bdf8"] },
  { id: "synthwave", name: "Synthwave Glow", color1: "#f43f5e", color2: "#6366f1", colors: ["#f43f5e", "#d946ef", "#6366f1"] },
  { id: "cosmic", name: "Cosmic Twilight", color1: "#3b82f6", color2: "#fb923c", colors: ["#3b82f6", "#8b5cf6", "#ec4899", "#fb923c"] },
  { id: "emerald-isle", name: "Emerald Isle", color1: "#10b981", color2: "#06b6d4", colors: ["#10b981", "#14b8a6", "#06b6d4"] },
  { id: "solar-flare", name: "Solar Flare", color1: "#ef4444", color2: "#fde047", colors: ["#ef4444", "#f97316", "#fde047"] },
  { id: "lavender-dream", name: "Lavender Dream", color1: "#c084fc", color2: "#fbcfe8", colors: ["#c084fc", "#e879f9", "#fbcfe8"] },
  { id: "midnight-abyss", name: "Midnight Abyss", color1: "#1e1b4b", color2: "#6366f1", colors: ["#1e1b4b", "#312e81", "#4338ca", "#6366f1"] },
] as const;

export const PRISM_PRESETS: readonly PrismPreset[] = [
  {
    id: "rainbow",
    name: "Vibrant Rainbow",
    colors: ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
  },
  {
    id: "pastel",
    name: "Pastel Dream",
    colors: ["#c4b5fd", "#93c5fd", "#6ee7b7", "#fde047", "#fca5a5"],
  },
  {
    id: "neon-prism",
    name: "Neon Spectrum",
    colors: ["#f43f5e", "#ec4899", "#8b5cf6", "#06b6d4", "#10b981"],
  },
  {
    id: "cyber-rainbow",
    name: "Cyberpunk Prism",
    colors: ["#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#f43f5e", "#fb923c"],
  },
  {
    id: "monochrome",
    name: "Monochrome Spectrum",
    colors: ["#ffffff", "#cbd5e1", "#94a3b8", "#64748b", "#334155", "#0f172a"],
  },
  {
    id: "borealis",
    name: "Borealis Radiance",
    colors: ["#059669", "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1"],
  },
  {
    id: "candy-carousel",
    name: "Candy Carousel",
    colors: ["#fb7185", "#f472b6", "#c084fc", "#818cf8", "#38bdf8", "#34d399", "#facc15"],
  },
  {
    id: "solar-storm",
    name: "Solar Storm",
    colors: ["#b91c1c", "#ea580c", "#f59e0b", "#eab308", "#84cc16", "#06b6d4"],
  },
] as const;

export const DEFAULT_PROFILE_CUSTOMIZATION: UserProfileCustomization = {
  displayName: "",
  displayNameStyle: {
    font: "default",
    effect: "solid",
    color: "#ffffff",
    color2: "#8b5cf6",
    colors: ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
  },
  pronouns: "",
  statusText: "",
  bio: "",
  avatarUrl: null,
  bannerUrl: null,
  bannerOverlayUrl: null,
  nameplateUrl: null,
  sidebarBannerUrl: null,
  avatarFrame: null,
  socialLinks: [],
  accentColor: null,
  pinnedSpotlight: null,
  showcaseBadgeIds: [],
  birthday: null,
  showBirthdayYear: true,
  country: null,
  region: null,
  location: null,
  timezone: null,
  website: null,
  privacy: {
    showBirthday: "public",
    showLocation: "public",
    allowComments: "public",
  },
};

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function isValidImageUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "none") return false;
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  );
}

/**
 * Safely extracts and normalizes the profile customization from any User.customization object.
 */
export function getProfileCustomization(customization: unknown): UserProfileCustomization {
  if (!customization || typeof customization !== "object") {
    return { ...DEFAULT_PROFILE_CUSTOMIZATION };
  }

  const raw = customization as Record<string, any>;
  const profile = (raw.profile && typeof raw.profile === "object") ? raw.profile : {};

  // Compatibility fallback for legacy top-level keys
  const legacyAvatar = isValidImageUrl(raw.avatarUrl) ? raw.avatarUrl : null;
  const legacyDisplayName = typeof raw.displayName === "string" ? raw.displayName : "";
  const legacySidebar = isValidImageUrl(raw.sidebarCardBackgroundUrl) ? raw.sidebarCardBackgroundUrl : null;

  const styleRaw = profile.displayNameStyle || {};

  // Effect mapping
  let effect: DisplayNameEffectType = "solid";
  if (styleRaw.effect) {
    if (
      [
        "solid",
        "gradient",
        "neon",
        "toon",
        "pop",
        "gummy",
        "prism",
        "glitch",
        "chrome",
        "flame",
        "celestial",
      ].includes(styleRaw.effect)
    ) {
      effect = styleRaw.effect as DisplayNameEffectType;
    } else if (styleRaw.effect === "neon-glow") {
      effect = "neon";
    } else if (styleRaw.effect === "cosmic-gradient" || styleRaw.effect === "aurora" || styleRaw.effect === "holographic") {
      effect = "gradient";
    } else if (styleRaw.effect === "cyber-glitch") {
      effect = "glitch";
    }
  }

  const avatarFrameUrl = isValidImageUrl(profile.avatarFrame)
    ? profile.avatarFrame
    : (isValidImageUrl(raw.avatarFrame) ? raw.avatarFrame : null);

  const avatarUrl = isValidImageUrl(profile.avatarUrl)
    ? profile.avatarUrl
    : legacyAvatar;

  const bannerUrl = isValidImageUrl(profile.bannerUrl)
    ? profile.bannerUrl
    : (isValidImageUrl(raw.bannerUrl) ? raw.bannerUrl : null);

  const bannerOverlayUrl = isValidImageUrl(profile.bannerOverlayUrl)
    ? profile.bannerOverlayUrl
    : (isValidImageUrl(raw.bannerOverlayUrl) ? raw.bannerOverlayUrl : null);

  const nameplateUrl = isValidImageUrl(profile.nameplateUrl)
    ? profile.nameplateUrl
    : (isValidImageUrl(profile.sidebarBannerUrl)
      ? profile.sidebarBannerUrl
      : (isValidImageUrl(profile.sidebarCardBackgroundUrl)
        ? profile.sidebarCardBackgroundUrl
        : legacySidebar));

  const socialLinks: SocialLink[] = Array.isArray(profile.socialLinks)
    ? profile.socialLinks.filter(
        (link: any): link is SocialLink =>
          link && typeof link === "object" && typeof link.url === "string" && link.url.trim() !== ""
      ).map((link: any) => ({
        url: link.url.trim(),
        label: typeof link.label === "string" && link.label.trim() !== "" ? link.label.trim() : undefined,
        platform: typeof link.platform === "string" ? link.platform : undefined,
      }))
    : [];

  const showcaseBadgeIds: number[] = Array.isArray(profile.showcaseBadgeIds)
    ? profile.showcaseBadgeIds
        .filter((id: any): id is number => typeof id === "number" && !isNaN(id))
        .slice(0, 10)
    : (Array.isArray(raw.showcaseBadgeIds)
      ? raw.showcaseBadgeIds
          .filter((id: any): id is number => typeof id === "number" && !isNaN(id))
          .slice(0, 10)
      : []);

  const pinnedSpotlight: PinnedSpotlight | null =
    profile.pinnedSpotlight && typeof profile.pinnedSpotlight === "object"
      ? {
          title: typeof profile.pinnedSpotlight.title === "string" ? profile.pinnedSpotlight.title : undefined,
          subtitle: typeof profile.pinnedSpotlight.subtitle === "string" ? profile.pinnedSpotlight.subtitle : undefined,
          mediaType: typeof profile.pinnedSpotlight.mediaType === "string" ? profile.pinnedSpotlight.mediaType : undefined,
          mediaId: typeof profile.pinnedSpotlight.mediaId === "number" ? profile.pinnedSpotlight.mediaId : undefined,
          customNote: typeof profile.pinnedSpotlight.customNote === "string" ? profile.pinnedSpotlight.customNote : undefined,
          imageUrl: typeof profile.pinnedSpotlight.imageUrl === "string" ? profile.pinnedSpotlight.imageUrl : undefined,
          link: typeof profile.pinnedSpotlight.link === "string" ? profile.pinnedSpotlight.link : undefined,
        }
      : null;

  const privacy: ProfilePrivacySettings = {
    showBirthday: profile.privacy?.showBirthday || "public",
    showLocation: profile.privacy?.showLocation || "public",
    allowComments: profile.privacy?.allowComments || "public",
  };

  const country = typeof profile.country === "string"
    ? profile.country
    : (typeof raw.country === "string" ? raw.country : null);

  const region = typeof profile.region === "string"
    ? profile.region
    : (typeof raw.region === "string" ? raw.region : null);

  const location = typeof profile.location === "string"
    ? profile.location
    : (typeof raw.location === "string"
      ? raw.location
      : (region && country ? `${region}, ${country}` : country || region || null));

  return {
    displayName: (typeof profile.displayName === "string" && profile.displayName.trim() !== "")
      ? profile.displayName
      : legacyDisplayName,
    displayNameStyle: {
      font: styleRaw.font || "default",
      effect,
      color: styleRaw.color || (effect === "solid" ? "currentColor" : "#ffffff"),
      color2: typeof styleRaw.color2 === "string" ? styleRaw.color2 : undefined,
      colors: Array.isArray(styleRaw.colors) && styleRaw.colors.length >= 2
        ? styleRaw.colors.slice(0, 8)
        : (effect === "gradient"
            ? [styleRaw.color || "#818cf8", styleRaw.color2 || "#c084fc"]
            : ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"]),
      positions: Array.isArray(styleRaw.positions)
        ? styleRaw.positions.slice(0, 8).map((p: unknown) => {
            const num = typeof p === "number" ? p : parseFloat(String(p));
            return isNaN(num) ? 0 : Math.max(0, Math.min(100, Math.round(num)));
          })
        : undefined,
    },
    pronouns: typeof profile.pronouns === "string" ? profile.pronouns : "",
    statusText: typeof profile.statusText === "string" ? profile.statusText : "",
    bio: typeof profile.bio === "string" ? profile.bio : "",
    avatarUrl,
    bannerUrl,
    bannerOverlayUrl,
    nameplateUrl,
    sidebarBannerUrl: nameplateUrl,
    avatarFrame: avatarFrameUrl,
    socialLinks,
    accentColor: typeof profile.accentColor === "string" ? profile.accentColor : null,
    pinnedSpotlight,
    showcaseBadgeIds,
    birthday: typeof profile.birthday === "string" ? profile.birthday : (typeof raw.birthday === "string" ? raw.birthday : null),
    showBirthdayYear: typeof profile.showBirthdayYear === "boolean" ? profile.showBirthdayYear : true,
    country,
    region,
    location,
    timezone: typeof profile.timezone === "string" ? profile.timezone : (typeof raw.timezone === "string" ? raw.timezone : null),
    website: typeof profile.website === "string" ? profile.website : (typeof raw.website === "string" ? raw.website : null),
    privacy,
  };
}

/**
 * Immutably applies profile customization patch into user customization object.
 */
export function setProfileCustomization(
  existingCustomization: unknown,
  patch: Partial<UserProfileCustomization>
): Record<string, unknown> {
  const current = (existingCustomization && typeof existingCustomization === "object")
    ? { ...(existingCustomization as Record<string, unknown>) }
    : {};

  const currentProfile = getProfileCustomization(current);

  const nameplate = patch.nameplateUrl !== undefined
    ? patch.nameplateUrl
    : (patch.sidebarBannerUrl !== undefined ? patch.sidebarBannerUrl : currentProfile.nameplateUrl);

  const bannerOverlay = patch.bannerOverlayUrl !== undefined
    ? patch.bannerOverlayUrl
    : currentProfile.bannerOverlayUrl;

  const updatedProfile: UserProfileCustomization = {
    ...currentProfile,
    ...patch,
    bannerOverlayUrl: isValidImageUrl(bannerOverlay) ? bannerOverlay : null,
    nameplateUrl: isValidImageUrl(nameplate) ? nameplate : null,
    sidebarBannerUrl: isValidImageUrl(nameplate) ? nameplate : null,
    avatarFrame: isValidImageUrl(patch.avatarFrame) ? patch.avatarFrame : null,
    displayNameStyle: {
      ...currentProfile.displayNameStyle,
      ...(patch.displayNameStyle || {}),
    },
    privacy: {
      ...currentProfile.privacy,
      ...(patch.privacy || {}),
    },
  };

  return {
    ...current,
    profile: updatedProfile,
    displayName: updatedProfile.displayName || undefined,
    avatarUrl: updatedProfile.avatarUrl || null,
    sidebarCardBackgroundUrl: updatedProfile.nameplateUrl || null,
  };
}

export const DEFAULT_DOCK_POSITIONS: DockPositions = {
  "1": null,
  "2": null,
  "3": null,
  "4": null,
};

/**
 * Safely extracts and normalizes the dock customization from any User.customization object.
 */
export function getDockCustomization(customization?: unknown): UserDockCustomization {
  if (!customization || typeof customization !== "object") {
    return { positions: { ...DEFAULT_DOCK_POSITIONS }, customGroups: [] };
  }
  const dock = (customization as any)?.dock;
  if (!dock || typeof dock !== "object") {
    return { positions: { ...DEFAULT_DOCK_POSITIONS }, customGroups: [] };
  }
  return {
    ...dock,
    positions: {
      ...DEFAULT_DOCK_POSITIONS,
      ...(dock.positions || {}),
    },
    customGroups: Array.isArray(dock.customGroups) ? dock.customGroups : [],
  };
}

/**
 * Immutably applies dock customization patch into user customization object.
 */
export function setDockCustomization(
  existingCustomization: unknown,
  patch: Partial<UserDockCustomization>
): Record<string, unknown> {
  const current = (existingCustomization && typeof existingCustomization === "object")
    ? { ...(existingCustomization as Record<string, unknown>) }
    : {};

  const currentDock = getDockCustomization(current);

  const updatedDock: UserDockCustomization = {
    ...currentDock,
    ...patch,
    positions: {
      ...currentDock.positions,
      ...(patch.positions || {}),
    },
    customGroups:
      patch.customGroups !== undefined ? patch.customGroups : currentDock.customGroups || [],
  };

  return {
    ...current,
    dock: updatedDock,
  };
}

/**
 * Computes high-visibility inline CSS styles for a display name based on effect and color parameters.
 */
export function getDisplayNameStyleCss(style?: DisplayNameStyle): Record<string, string | number> {
  if (!style) return {};

  const css: Record<string, string | number> = {};

  if (style.font && style.font !== "default") {
    const preset = FONT_PRESETS.find((f) => f.id === style.font);
    if (preset) {
      css.fontFamily = preset.family;
    }
  }

  const effect = style.effect || "solid";
  const c1 = style.color && style.color !== "currentColor" ? style.color : "#ffffff";
  const c2 = style.color2 || "#8b5cf6";
  const customStops = (Array.isArray(style.colors) && style.colors.length >= 2)
    ? style.colors
    : null;

  const buildStopsCss = (colors: string[], positions?: number[]): string => {
    return colors
      .map((col, idx) => {
        const pos = positions?.[idx];
        return typeof pos === "number" && !isNaN(pos) ? `${col} ${pos}%` : col;
      })
      .join(", ");
  };

  switch (effect) {
    case "solid":
      if (style.color && style.color !== "currentColor") {
        css.color = style.color;
      }
      break;

    case "gradient": {
      const gradientColors = customStops || [c1, c2];
      const stopsStr = buildStopsCss(gradientColors, style.positions);
      const gradientCss = `linear-gradient(135deg, ${stopsStr})`;
      css.backgroundImage = gradientCss;
      css.WebkitBackgroundImage = gradientCss;
      css.WebkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.WebkitTextFillColor = "transparent";
      css.color = "transparent";
      css.fontWeight = 700;
      break;
    }

    case "neon":
      css.color = "#ffffff";
      css.textShadow = `0 0 4px ${c1}, 0 0 10px ${c1}, 0 0 20px ${c1}, 0 0 35px ${c1}`;
      css.fontWeight = 700;
      break;

    case "toon":
      css.color = c1;
      css.textShadow = `-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 3px 3px 0px rgba(0,0,0,0.85)`;
      css.fontWeight = 800;
      css.letterSpacing = "0.04em";
      break;

    case "pop":
      css.color = c1;
      css.textShadow = `1.5px 1.5px 0px ${c2}, 3px 3px 0px ${c2}, 4.5px 4.5px 0px rgba(0,0,0,0.6)`;
      css.fontWeight = 800;
      break;

    case "gummy":
      css.backgroundImage = `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, ${c1} 45%, ${c1} 100%)`;
      css.WebkitBackgroundImage = `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, ${c1} 45%, ${c1} 100%)`;
      css.WebkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.WebkitTextFillColor = "transparent";
      css.color = "transparent";
      css.fontWeight = 800;
      css.filter = `drop-shadow(0 2px 6px ${c1}88)`;
      break;

    case "prism": {
      const prismColors = customStops || ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
      const stopsStr = buildStopsCss(prismColors, style.positions);
      const prismCss = `linear-gradient(90deg, ${stopsStr})`;
      css.backgroundImage = prismCss;
      css.WebkitBackgroundImage = prismCss;
      css.WebkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.WebkitTextFillColor = "transparent";
      css.color = "transparent";
      css.fontWeight = 800;
      css.filter = "drop-shadow(0 0 6px rgba(255,255,255,0.25))";
      break;
    }

    case "glitch":
      css.color = "#ffffff";
      css.textShadow = `-2px 0 0 #06b6d4, 2px 0 0 #ef4444, 0 0 8px rgba(6,182,212,0.6)`;
      css.fontWeight = 800;
      css.letterSpacing = "0.05em";
      break;

    case "chrome":
      css.backgroundImage = `linear-gradient(180deg, #f8fafc 0%, #cbd5e1 35%, #475569 50%, #94a3b8 70%, #f1f5f9 100%)`;
      css.WebkitBackgroundImage = `linear-gradient(180deg, #f8fafc 0%, #cbd5e1 35%, #475569 50%, #94a3b8 70%, #f1f5f9 100%)`;
      css.WebkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.WebkitTextFillColor = "transparent";
      css.color = "transparent";
      css.fontWeight = 800;
      css.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.5))";
      break;

    case "flame":
      css.backgroundImage = `linear-gradient(180deg, #fef08a 0%, #f97316 45%, #dc2626 100%)`;
      css.WebkitBackgroundImage = `linear-gradient(180deg, #fef08a 0%, #f97316 45%, #dc2626 100%)`;
      css.WebkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.WebkitTextFillColor = "transparent";
      css.color = "transparent";
      css.fontWeight = 800;
      css.filter = `drop-shadow(0 0 8px #f97316) drop-shadow(0 0 16px #ef4444)`;
      break;

    case "celestial":
      css.backgroundImage = `linear-gradient(135deg, #38bdf8 0%, #a855f7 50%, #ec4899 100%)`;
      css.WebkitBackgroundImage = `linear-gradient(135deg, #38bdf8 0%, #a855f7 50%, #ec4899 100%)`;
      css.WebkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.WebkitTextFillColor = "transparent";
      css.color = "transparent";
      css.fontWeight = 800;
      css.filter = "drop-shadow(0 0 8px rgba(168,85,247,0.5)) drop-shadow(0 0 16px rgba(56,189,248,0.3))";
      break;
  }

  return css;
}

/**
 * Computes extra CSS class names for text effects.
 */
export function getDisplayNameEffectClasses(effectId?: string): string {
  if (!effectId || effectId === "solid") return "";
  if (effectId === "glitch") return "transition-all duration-200 select-none animate-pulse";
  return "transition-all duration-200 select-none";
}
