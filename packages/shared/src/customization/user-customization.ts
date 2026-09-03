export type DisplayNameEffectType =
  | "solid"
  | "gradient"
  | "neon"
  | "toon"
  | "pop"
  | "gummy"
  | "prism";

export interface DisplayNameStyle {
  font?: string;
  effect?: DisplayNameEffectType | string;
  color?: string;
  color2?: string;
  colors?: string[]; // Array of 5 colors for prism or multi-stop gradients
}

export interface UserProfileCustomization {
  displayName?: string;
  displayNameStyle?: DisplayNameStyle;
  pronouns?: string;
  statusText?: string;
  bio?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  nameplateUrl?: string | null;
  sidebarBannerUrl?: string | null; // Backwards-compatible alias for nameplateUrl
  avatarFrame?: string | null; // URL of uploaded PNG/SVG transparent frame overlay
}

export type MediaTitleLanguage = "primary" | "secondary" | "native";

export interface UserMediaPreferences {
  title?: MediaTitleLanguage;
}

export interface UserPreferencesCustomization {
  media?: UserMediaPreferences;
}

export interface UserCustomization {
  profile?: UserProfileCustomization;
  appearance?: Record<string, unknown>;
  sidebar?: Record<string, unknown>;
  dock?: Record<string, unknown>;
  preferences?: UserPreferencesCustomization;
  [key: string]: unknown;
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
}

export interface PrismPreset {
  id: string;
  name: string;
  colors: [string, string, string, string, string];
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
] as const;

export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  { id: "cyber", name: "Cyberpunk", color1: "#818cf8", color2: "#c084fc" },
  { id: "sunset", name: "Sunset", color1: "#f97316", color2: "#ec4899" },
  { id: "ocean", name: "Ocean Wave", color1: "#06b6d4", color2: "#3b82f6" },
  { id: "aurora", name: "Aurora", color1: "#10b981", color2: "#06b6d4" },
  { id: "fire", name: "Wildfire", color1: "#f59e0b", color2: "#ef4444" },
  { id: "galaxy", name: "Galaxy", color1: "#a855f7", color2: "#38bdf8" },
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
  nameplateUrl: null,
  sidebarBannerUrl: null,
  avatarFrame: null,
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
    if (["solid", "gradient", "neon", "toon", "pop", "gummy", "prism"].includes(styleRaw.effect)) {
      effect = styleRaw.effect as DisplayNameEffectType;
    } else if (styleRaw.effect === "neon-glow") {
      effect = "neon";
    } else if (styleRaw.effect === "cosmic-gradient" || styleRaw.effect === "aurora" || styleRaw.effect === "holographic") {
      effect = "gradient";
    } else if (styleRaw.effect === "cyber-glitch") {
      effect = "toon";
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

  const nameplateUrl = isValidImageUrl(profile.nameplateUrl)
    ? profile.nameplateUrl
    : (isValidImageUrl(profile.sidebarBannerUrl)
      ? profile.sidebarBannerUrl
      : (isValidImageUrl(profile.sidebarCardBackgroundUrl)
        ? profile.sidebarCardBackgroundUrl
        : legacySidebar));

  return {
    displayName: (typeof profile.displayName === "string" && profile.displayName.trim() !== "")
      ? profile.displayName
      : legacyDisplayName,
    displayNameStyle: {
      font: styleRaw.font || "default",
      effect,
      color: styleRaw.color || (effect === "solid" ? "currentColor" : "#ffffff"),
      color2: styleRaw.color2 || "#8b5cf6",
      colors: Array.isArray(styleRaw.colors) && styleRaw.colors.length >= 5
        ? styleRaw.colors
        : ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
    },
    pronouns: typeof profile.pronouns === "string" ? profile.pronouns : "",
    statusText: typeof profile.statusText === "string" ? profile.statusText : "",
    bio: typeof profile.bio === "string" ? profile.bio : "",
    avatarUrl,
    bannerUrl,
    nameplateUrl,
    sidebarBannerUrl: nameplateUrl,
    avatarFrame: avatarFrameUrl,
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

  const updatedProfile: UserProfileCustomization = {
    ...currentProfile,
    ...patch,
    nameplateUrl: isValidImageUrl(nameplate) ? nameplate : null,
    sidebarBannerUrl: isValidImageUrl(nameplate) ? nameplate : null,
    avatarFrame: isValidImageUrl(patch.avatarFrame) ? patch.avatarFrame : null,
    displayNameStyle: {
      ...currentProfile.displayNameStyle,
      ...(patch.displayNameStyle || {}),
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
  const prismColors = (style.colors && style.colors.length >= 5)
    ? style.colors
    : ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  switch (effect) {
    case "solid":
      if (style.color && style.color !== "currentColor") {
        css.color = style.color;
      }
      break;

    case "gradient":
      css.backgroundImage = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
      css.WebkitBackgroundImage = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
      css.WebkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.WebkitTextFillColor = "transparent";
      css.color = "transparent";
      css.fontWeight = 700;
      break;

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

    case "prism":
      css.backgroundImage = `linear-gradient(90deg, ${prismColors[0]} 0%, ${prismColors[1]} 25%, ${prismColors[2]} 50%, ${prismColors[3]} 75%, ${prismColors[4]} 100%)`;
      css.WebkitBackgroundImage = `linear-gradient(90deg, ${prismColors[0]} 0%, ${prismColors[1]} 25%, ${prismColors[2]} 50%, ${prismColors[3]} 75%, ${prismColors[4]} 100%)`;
      css.WebkitBackgroundClip = "text";
      css.backgroundClip = "text";
      css.WebkitTextFillColor = "transparent";
      css.color = "transparent";
      css.fontWeight = 800;
      css.filter = "drop-shadow(0 0 6px rgba(255,255,255,0.25))";
      break;
  }

  return css;
}

/**
 * Computes extra CSS class names for text effects.
 */
export function getDisplayNameEffectClasses(effectId?: string): string {
  if (!effectId || effectId === "solid") return "";
  return "transition-all duration-200 select-none";
}
