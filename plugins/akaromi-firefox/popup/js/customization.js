/**
 * Akaromi for Firefox — User Customization & Display Name Styling Engine
 * Mirrors @IRIS/shared user customization logic for Firefox extension
 */
;(function (global) {
  "use strict"

  // Font presets matching @IRIS/shared
  const FONT_PRESETS = [
    { id: "default", family: "var(--font-sans, inherit)" },
    { id: "inter", family: "'Inter', sans-serif" },
    { id: "mono", family: "'JetBrains Mono', monospace" },
    { id: "serif", family: "'Playfair Display', Georgia, serif" },
    { id: "orbitron", family: "'Orbitron', sans-serif" },
    { id: "cinzel", family: "'Cinzel', serif" },
    { id: "script", family: "'Dancing Script', cursive" },
    { id: "cyberpunk", family: "'Blender Pro', 'Orbitron', monospace, sans-serif" },
    { id: "pixel", family: "'Press Start 2P', monospace" },
    { id: "blackletter", family: "'UnifrakturMaguntia', 'Cinzel', serif" },
  ]

  function isValidImageUrl(url) {
    if (!url || typeof url !== "string") return false
    const trimmed = url.trim()
    if (!trimmed || trimmed === "none") return false
    return (
      trimmed.startsWith("/") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:")
    )
  }

  function resolveMediaUrl(url, serverUrl) {
    if (!url || typeof url !== "string") return ""
    const trimmed = url.trim()
    if (!trimmed || trimmed === "none") return ""
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:")
    ) {
      return trimmed
    }
    const base = (serverUrl || "http://localhost:4000").replace(/\/$/, "")
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    return `${base}${path}`
  }

  function getProfileCustomization(customization) {
    if (!customization) return {}
    let raw = customization
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw)
      } catch {
        raw = {}
      }
    }
    if (typeof raw !== "object" || raw === null) return {}

    const profile = raw.profile && typeof raw.profile === "object" ? raw.profile : {}

    const legacyAvatar = isValidImageUrl(raw.avatarUrl) ? raw.avatarUrl : null
    const legacyDisplayName = typeof raw.displayName === "string" ? raw.displayName : ""
    const legacySidebar = isValidImageUrl(raw.sidebarCardBackgroundUrl) ? raw.sidebarCardBackgroundUrl : null

    const nameplate = isValidImageUrl(profile.nameplateUrl)
      ? profile.nameplateUrl
      : isValidImageUrl(profile.sidebarBannerUrl)
        ? profile.sidebarBannerUrl
        : legacySidebar

    return {
      displayName: profile.displayName || legacyDisplayName || "",
      displayNameStyle: profile.displayNameStyle || null,
      statusText: profile.statusText || "",
      avatarUrl: isValidImageUrl(profile.avatarUrl) ? profile.avatarUrl : legacyAvatar,
      nameplateUrl: nameplate,
      sidebarBannerUrl: nameplate,
      avatarFrame: isValidImageUrl(profile.avatarFrame) ? profile.avatarFrame : null,
      pronouns: profile.pronouns || "",
      bio: profile.bio || "",
    }
  }

  function buildStopsCss(colors, positions) {
    return colors
      .map((col, idx) => {
        const pos = positions?.[idx]
        return typeof pos === "number" && !isNaN(pos) ? `${col} ${pos}%` : col
      })
      .join(", ")
  }

  function getDisplayNameStyleCss(style) {
    if (!style) return {}
    const css = {}

    if (style.font && style.font !== "default") {
      const preset = FONT_PRESETS.find((f) => f.id === style.font)
      if (preset) {
        css.fontFamily = preset.family
      }
    }

    const effect = style.effect || "solid"
    const c1 = style.color && style.color !== "currentColor" ? style.color : "#ffffff"
    const c2 = style.color2 || "#8b5cf6"
    const customStops = Array.isArray(style.colors) && style.colors.length >= 2 ? style.colors : null

    switch (effect) {
      case "solid":
        if (style.color && style.color !== "currentColor") {
          css.color = style.color
        }
        break

      case "gradient": {
        const gradientColors = customStops || [c1, c2]
        const stopsStr = buildStopsCss(gradientColors, style.positions)
        const gradientCss = `linear-gradient(135deg, ${stopsStr})`
        css.backgroundImage = gradientCss
        css.webkitBackgroundImage = gradientCss
        css.webkitBackgroundClip = "text"
        css.backgroundClip = "text"
        css.webkitTextFillColor = "transparent"
        css.color = "transparent"
        css.fontWeight = "700"
        break
      }

      case "neon":
        css.color = "#ffffff"
        css.textShadow = `0 0 4px ${c1}, 0 0 10px ${c1}, 0 0 20px ${c1}, 0 0 35px ${c1}`
        css.fontWeight = "700"
        break

      case "toon":
        css.color = c1
        css.textShadow = `-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 3px 3px 0px rgba(0,0,0,0.85)`
        css.fontWeight = "800"
        css.letterSpacing = "0.04em"
        break

      case "pop":
        css.color = c1
        css.textShadow = `1.5px 1.5px 0px ${c2}, 3px 3px 0px ${c2}, 4.5px 4.5px 0px rgba(0,0,0,0.6)`
        css.fontWeight = "800"
        break

      case "gummy":
        css.backgroundImage = `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, ${c1} 45%, ${c1} 100%)`
        css.webkitBackgroundImage = `linear-gradient(180deg, rgba(255,255,255,0.9) 0%, ${c1} 45%, ${c1} 100%)`
        css.webkitBackgroundClip = "text"
        css.backgroundClip = "text"
        css.webkitTextFillColor = "transparent"
        css.color = "transparent"
        css.fontWeight = "800"
        css.filter = `drop-shadow(0 2px 6px ${c1}88)`
        break

      case "prism": {
        const prismColors = customStops || ["#a855f7", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"]
        const stopsStr = buildStopsCss(prismColors, style.positions)
        const prismCss = `linear-gradient(90deg, ${stopsStr})`
        css.backgroundImage = prismCss
        css.webkitBackgroundImage = prismCss
        css.webkitBackgroundClip = "text"
        css.backgroundClip = "text"
        css.webkitTextFillColor = "transparent"
        css.color = "transparent"
        css.fontWeight = "800"
        css.filter = "drop-shadow(0 0 6px rgba(255,255,255,0.25))"
        break
      }

      case "glitch":
        css.color = "#ffffff"
        css.textShadow = `-2px 0 0 #06b6d4, 2px 0 0 #ef4444, 0 0 8px rgba(6,182,212,0.6)`
        css.fontWeight = "800"
        css.letterSpacing = "0.05em"
        break

      case "chrome":
        css.backgroundImage = `linear-gradient(180deg, #f8fafc 0%, #cbd5e1 35%, #475569 50%, #94a3b8 70%, #f1f5f9 100%)`
        css.webkitBackgroundImage = `linear-gradient(180deg, #f8fafc 0%, #cbd5e1 35%, #475569 50%, #94a3b8 70%, #f1f5f9 100%)`
        css.webkitBackgroundClip = "text"
        css.backgroundClip = "text"
        css.webkitTextFillColor = "transparent"
        css.color = "transparent"
        css.fontWeight = "800"
        css.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
        break

      case "flame":
        css.backgroundImage = `linear-gradient(180deg, #fef08a 0%, #f97316 45%, #dc2626 100%)`
        css.webkitBackgroundImage = `linear-gradient(180deg, #fef08a 0%, #f97316 45%, #dc2626 100%)`
        css.webkitBackgroundClip = "text"
        css.backgroundClip = "text"
        css.webkitTextFillColor = "transparent"
        css.color = "transparent"
        css.fontWeight = "800"
        css.filter = `drop-shadow(0 0 8px #f97316) drop-shadow(0 0 16px #ef4444)`
        break

      case "celestial":
        css.backgroundImage = `linear-gradient(135deg, #38bdf8 0%, #a855f7 50%, #ec4899 100%)`
        css.webkitBackgroundImage = `linear-gradient(135deg, #38bdf8 0%, #a855f7 50%, #ec4899 100%)`
        css.webkitBackgroundClip = "text"
        css.backgroundClip = "text"
        css.webkitTextFillColor = "transparent"
        css.color = "transparent"
        css.fontWeight = "800"
        css.filter = "drop-shadow(0 0 8px rgba(168,85,247,0.5)) drop-shadow(0 0 16px rgba(56,189,248,0.3))"
        break
    }

    return css
  }

  function getDisplayNameEffectClasses(effectId) {
    if (!effectId || effectId === "solid") return ""
    if (effectId === "glitch") return "effect-glitch"
    return ""
  }

  global.AkaromiCustomization = {
    FONT_PRESETS,
    isValidImageUrl,
    resolveMediaUrl,
    getProfileCustomization,
    getDisplayNameStyleCss,
    getDisplayNameEffectClasses,
  }
})(typeof window !== "undefined" ? window : globalThis)
