"use client"

import { cn } from "cn"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

// Recreates Wallpaper Engine genericimage4 (LIGHTING=1, REFLECTION=1), foliagesway (MODE=0), and display color grading + region lighting
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform sampler2D uSwayMask;
  uniform float uHasSwayMask;
  uniform float uSwayStrength;
  uniform float uTime;
  uniform vec4 uUvRect;
  uniform float uFlipX;
  uniform vec2 uEdgeFade;
  uniform vec3 uCameraPos;
  uniform float uTexAspect;

  uniform float uRoughness;
  uniform float uMetallic;
  uniform float uTransparent;
  uniform vec3 uSpecularTint;
  uniform vec3 uAmbientColor;
  uniform vec3 uLightColor;
  uniform vec3 uLightPos;
  uniform float uLightIntensity;
  uniform float uLightRadius;
  uniform float uLightExponent;

  uniform float uLightingEnabled;
  uniform float uAmbientLevel;
  uniform float uSpotMode;
  uniform vec2 uSpotCenterUv;
  uniform float uSpotRadius;
  uniform float uSpotSoftness;
  uniform float uSpotIntensity;
  uniform vec3 uSpotColor;

  uniform float uImageFilter;
  uniform float uColorEnabled;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uHueShift;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;

  const float PI = 3.14159265359;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  vec3 applyHueShift(vec3 col, float angleRad) {
    if (abs(angleRad) < 0.0001) return col;
    const vec3 k = vec3(0.57735027);
    float c = cos(angleRad);
    float s = sin(angleRad);
    return col * c + cross(k, col) * s + k * dot(k, col) * (1.0 - c);
  }

  vec3 applySaturation(vec3 col, float satFactor) {
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(luma), col, satFactor);
  }

  vec3 applyContrastMasked(vec3 col, float contrastFactor, float mask) {
    vec3 contrasted = max((col - 0.5) * contrastFactor + 0.5, vec3(0.0));
    return max(mix(col, contrasted, mask), vec3(0.0));
  }

  vec3 applyImageFilterPreset(vec3 col, float preset, float inkWeight) {
    if (preset < 0.5) return col;

    // 1: Vibrant Darkness
    if (preset < 1.5) {
      vec3 outCol = applySaturation(col, 1.38);
      outCol = pow(max(outCol, vec3(0.0)), vec3(1.12));
      vec3 curved = max((outCol - 0.42) * 1.24 + 0.42, vec3(0.0));
      return max(mix(outCol, curved, inkWeight), vec3(0.0));
    }

    // 2: Moon Light
    if (preset < 2.5) {
      vec3 outCol = applySaturation(col, 0.72);
      outCol *= vec3(0.76, 0.88, 1.18);
      return applyContrastMasked(outCol, 1.06, inkWeight);
    }

    // 3: Overcast
    vec3 outCol = applySaturation(col, 0.45);
    outCol *= vec3(0.84, 0.89, 0.96);
    return applyContrastMasked(outCol, 0.82, inkWeight);
  }

  float spotFalloff(float innerR, float outerR, float d) {
    float f = clamp(1.0 - smoothstep(innerR, outerR, d), 0.0, 1.0);
    return f * mix(1.0, f, 0.4);
  }

  float computeSpotMask(vec2 baseUv) {
    if (uLightingEnabled < 0.5 || uSpotMode < 0.5) {
      return 0.0;
    }

    float outerR = max(uSpotRadius, 0.05);
    float innerR = outerR * (1.0 - clamp(uSpotSoftness, 0.08, 0.98));

    // 1: Pinned body-part spotlight
    if (uSpotMode < 1.5) {
      vec2 delta = (baseUv - uSpotCenterUv) * vec2(uTexAspect, 1.0);
      return spotFalloff(innerR, outerR, length(delta));
    }

    // 2: Vertical scan beam (crown <-> feet)
    if (uSpotMode < 2.5) {
      float scanY = 0.5 + 0.36 * cos(uTime * 0.65);
      vec2 delta = vec2((baseUv.x - uSpotCenterUv.x) * 0.42, baseUv.y - scanY);
      return spotFalloff(innerR * 0.65, outerR, length(delta));
    }

    // 3: Orbiting halo spotlight
    if (uSpotMode < 3.5) {
      float angle = uTime * 0.72;
      vec2 orbitCenter = uSpotCenterUv + vec2(0.18 * cos(angle), 0.28 * sin(angle));
      vec2 delta = (baseUv - orbitCenter) * vec2(uTexAspect, 1.0);
      return spotFalloff(innerR, outerR, length(delta));
    }

    // 4: Dual counter-traveling filigree shimmer bands
    float w1 = abs(fract(baseUv.y * 0.75 + baseUv.x * 0.28 - uTime * 0.14) - 0.5) * 2.0;
    float w2 = abs(fract(baseUv.y * 0.65 - baseUv.x * 0.22 + uTime * 0.11) - 0.5) * 2.0;
    float beamW = max(outerR * 0.85, 0.14);
    float b1 = spotFalloff(0.0, beamW, w1);
    float b2 = 0.75 * spotFalloff(0.0, beamW, w2);
    return max(b1, b2);
  }

  vec2 computeSwayUv(vec2 baseUv) {
    if (uSwayStrength <= 0.000001 || uHasSwayMask < 0.5) {
      return baseUv;
    }

    float maskWeight = texture2D(uSwayMask, baseUv).r;
    if (maskWeight <= 0.001) {
      return baseUv;
    }

    vec2 fullUv = vec2(
      uUvRect.x + baseUv.x * uUvRect.z,
      uUvRect.y + (1.0 - baseUv.y) * uUvRect.w
    );
    float noise = smoothNoise(fullUv * 12.8);
    float phase = (noise * 6.2831853 + fullUv.x * 10.0 + fullUv.y * 5.0) * 0.5;
    float t = uTime * 1.05;

    vec4 sines = sin(phase + t * vec4(1.0, -0.16161616, 0.0083333, -0.00019841));
    vec4 csines = sin(0.4 + phase + t * vec4(-0.5, 0.041666666, -0.0013888889, 0.000024801587));
    float amp = uSwayStrength * maskWeight;

    vec2 fullOffset = vec2(
      1.87555 * dot(sines, vec4(amp)),
      0.533175 * dot(csines, vec4(amp))
    );
    vec2 localOffset = vec2(
      fullOffset.x / max(uUvRect.z, 0.0001),
      -fullOffset.y / max(uUvRect.w, 0.0001)
    );
    vec2 edgeFade = smoothstep(0.0, 0.015, baseUv) * (1.0 - smoothstep(0.985, 1.0, baseUv));
    return clamp(baseUv + localOffset * edgeFade, 0.0, 1.0);
  }

  void main() {
    vec2 baseUv = vec2(mix(vUv.x, 1.0 - vUv.x, uFlipX), vUv.y);
    vec2 sampleUv = computeSwayUv(baseUv);
    vec4 texel = texture2D(uTexture, sampleUv);

    float borderMask = 1.0;
    if (uEdgeFade.x > 0.0001) {
      borderMask *= 1.0 - smoothstep(1.0 - uEdgeFade.x, 1.0, baseUv.x);
    }
    if (uEdgeFade.y > 0.0001) {
      borderMask *= smoothstep(0.0, uEdgeFade.y, baseUv.y);
    }
    texel *= borderMask;

    vec3 albedo = texel.rgb;

    vec3 lightVec = uLightPos - vWorldPos;
    float dist = length(lightVec);
    vec3 L = lightVec / max(dist, 0.0001);

    float atten = clamp(1.0 - dist / uLightRadius, 0.0, 1.0);
    atten = pow(atten, uLightExponent);
    vec3 radiance = uLightColor * (uLightIntensity * atten);

    vec3 N = normalize(vWorldNormal);
    if (N.z < 0.0) N = -N;
    vec3 V = normalize(uCameraPos - vWorldPos);
    vec3 H = normalize(L + V);

    float NdotH = max(dot(N, H), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.001);
    float VdotH = max(dot(V, H), 0.0);
    float oneMinusVdotH = max(1.0 - VdotH, 0.001);

    float a = uRoughness * uRoughness;
    float a2 = a * a;
    float denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
    float D = a2 / (PI * denom * denom);

    float k = (uRoughness + 1.0) * (uRoughness + 1.0) * 0.125;
    float G = (NdotL / (NdotL * (1.0 - k) + k)) * (NdotV / (NdotV * (1.0 - k) + k));

    vec3 F0 = mix(vec3(0.04), albedo, uMetallic);
    float fresnelPow = oneMinusVdotH * oneMinusVdotH;
    fresnelPow = fresnelPow * fresnelPow;
    vec3 F = F0 + (1.0 - F0) * fresnelPow;

    vec3 specular = ((G * D * F) / max(4.0 * NdotV * NdotL, 0.001)) * uSpecularTint;
    float inkMask = smoothstep(0.0, 0.025, max(albedo.r, max(albedo.g, albedo.b)));
    specular *= mix(inkMask, texel.a, uTransparent);

    vec3 kD = (1.0 - F) * (1.0 - uMetallic);
    vec3 diffuse = (kD * albedo) / PI;

    vec3 lo = (diffuse + specular) * radiance * NdotL;
    float spotMask = computeSpotMask(baseUv);
    vec3 baseAmbient = (uAmbientColor * uAmbientLevel) * albedo;
    vec3 spotBoost = uSpotColor * (uSpotIntensity * spotMask) * albedo;
    vec3 color = baseAmbient + lo + spotBoost;

    vec3 finalColor = clamp(color, 0.0, 1.0);
    if (uImageFilter > 0.5 || uColorEnabled > 0.5) {
      if (uTransparent > 0.5 && texel.a <= 0.001) {
        gl_FragColor = vec4(0.0);
        return;
      }

      vec3 work = uTransparent > 0.5 ? clamp(color / texel.a, 0.0, 4.0) : color;
      float mask = smoothstep(0.0, 0.035, max(work.r, max(work.g, work.b)));

      if (uImageFilter > 0.5) {
        work = applyImageFilterPreset(work, uImageFilter, mask);
      }

      if (uColorEnabled > 0.5) {
        work = applyHueShift(work, uHueShift);
        work = applySaturation(work, uSaturation);
        work = applyContrastMasked(work, uContrast, mask);
        work = max(work * uBrightness, vec3(0.0));
      }

      finalColor = clamp(
        uTransparent > 0.5 ? work * texel.a : work,
        0.0,
        1.0
      );
    }

    gl_FragColor = vec4(finalColor, texel.a);
  }
`

const DEFAULT_WORLD_HEIGHT = 2160
const CAMERA_FOV_DEG = 35
const LIGHT_Z = 250.0
const LIGHT_INTENSITY = 6.0
const LIGHT_RADIUS = 1000.0
const LIGHT_EXPONENT = 3.11
const SWAY_STRENGTH = 0.42 * 0.42 * 0.005
const DEFAULT_UV_RECT: readonly [number, number, number, number] = [0, 0, 1, 1]

export type ReactiveSurfaceLayout =
  "bottom-right" | "bottom-left" | "center" | "top-center" | "contain-center"

export interface ColorOptions {
  /** Whether color adjustments are applied (defaults to `true`). */
  enabled?: boolean
  /** Brightness level from 0 to 100 (default `50` = neutral). */
  brightness?: number
  /** Contrast level from 0 to 100 (default `50` = neutral). */
  contrast?: number
  /** Saturation level from 0 to 100 (default `50` = neutral). */
  saturation?: number
  /** Hue rotation from 0 to 100 (default `50` = 0° shift). */
  hueShift?: number
}

export interface ViewOptions {
  /** Whether custom position, zoom, and rotation overrides are applied (defaults to `true`). */
  enabled?: boolean
  /** Placement anchor inside the viewport (defaults to the component's `layout`). */
  anchor?: ReactiveSurfaceLayout
  /** Zoom percentage from 40 to 300 (default `100` = 1.0x). */
  zoom?: number
  /** Horizontal pan offset percentage from -100 to 100 (default `0`). */
  panX?: number
  /** Vertical pan offset percentage from -100 to 100 (default `0`). */
  panY?: number
  /** In-plane clockwise rotation in degrees from -180 to 180 (default `0`). */
  rotation?: number
  /** 3D perspective pitch angle in degrees from -45 to 45 (default `0`). */
  tiltX?: number
  /** 3D perspective yaw angle in degrees from -45 to 45 (default `0`). */
  tiltY?: number
  /** Mirror horizontally across the artwork's center axis (default `false`). */
  flipX?: boolean
}

export type LightingMode =
  "hover" | "spot" | "scan-vertical" | "scan-orbit" | "dual-bands"

export type LightTintPreset =
  "white" | "coral" | "moonlight" | "gold" | "violet"

export interface LightingOptions {
  /** Whether custom part-lighting & ambient dimming overrides are applied (defaults to `true`). */
  enabled?: boolean
  /** Base ambient brightness percentage from 0 to 100 (default `100` = full base glow). */
  ambient?: number
  /** Spotlight mode highlighting regions or scanning across the figure (default `"hover"`). */
  mode?: LightingMode
  /** Horizontal focus coordinate on character from 0 to 100 (left to right, default `54`). */
  focusX?: number
  /** Vertical focus coordinate on character from 0 to 100 (top to bottom, default `30`). */
  focusY?: number
  /** Spotlight radius percentage from 10 to 120 (default `42`). */
  radius?: number
  /** Spotlight edge feathering percentage from 10 to 100 (default `65`). */
  softness?: number
  /** Spotlight boost strength percentage from 0 to 250 (default `125`). */
  intensity?: number
  /** Color temperature / tint preset for the spotlight (default `"white"`). */
  tint?: LightTintPreset
}

export type ImageFilterPreset =
  "none" | "vibrant-darkness" | "moon-light" | "overcast"

export interface ReactiveBackgroundVariantProps {
  /** Optional container classes; defaults to filling its parent (`h-full w-full` or `size-full`). */
  className?: string
  /** Enable Wallpaper Engine foliage-sway & animated light sweeps (defaults to `true`). */
  animated?: boolean
  /** Playback rate percentage where `100` is 1.0x speed (defaults to `100`). */
  playbackRate?: number
  /** Viewport framing, zoom, pan, flip, 2D rotation, and 3D perspective tilt. */
  viewOptions?: ViewOptions
  /** Ambient base dimming, body-part spotlight focus, and animated light scans. */
  lightingOptions?: LightingOptions
  /** Toggleable color grading adjustments (brightness, contrast, saturation, hueShift default `50`). */
  colorOptions?: ColorOptions
  /** Preset image filter (`"none"` disables filtering, defaults to `"none"`). */
  imageFilter?: ImageFilterPreset
  /** Explicitly toggle the active `imageFilter` on/off without losing preset state (defaults to `true`). */
  imageFilterEnabled?: boolean
}

export interface ReactiveBackgroundProps extends ReactiveBackgroundVariantProps {
  /** Path to the preprocessed artwork texture. */
  textureUrl: string
  /** Pixel width of the preprocessed artwork texture. */
  textureWidth: number
  /** Pixel height of the preprocessed artwork texture. */
  textureHeight: number
  /** Material roughness from the Wallpaper Engine shader config. */
  roughness: number
  /** Specular tint scalar from the Wallpaper Engine shader config (0 disables GGX reflection). */
  specularTint: number
  /** Optional grayscale sway mask PNG aligned to `textureUrl`. */
  swayMaskUrl?: string
  /** Normalized `[u0, v0, uW, vH]` bounding box inside the original Wallpaper Engine canvas. */
  uvRect?: readonly [number, number, number, number]
  /** Material metallic factor (defaults to 0). */
  metallic?: number
  /** Viewport placement mode (defaults to `"bottom-right"`). */
  layout?: ReactiveSurfaceLayout
  /** Render onto a transparent premultiplied-alpha canvas instead of solid `#000000`. */
  transparent?: boolean
  /** World-space scale reference (height for `"bottom-right"`, max edge for `"contain-center"`). */
  worldSpan?: number
}

const LIGHT_TINT_RGB: Record<
  LightTintPreset,
  readonly [number, number, number]
> = {
  white: [1.0, 1.0, 1.0],
  coral: [1.22, 0.82, 0.76],
  moonlight: [0.76, 0.9, 1.26],
  gold: [1.24, 1.02, 0.7],
  violet: [1.04, 0.8, 1.28],
}

function clampChannel(value: number | undefined, fallback = 50) {
  return Math.min(100, Math.max(0, value ?? fallback))
}

function clampRange(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
) {
  return Math.min(max, Math.max(min, value ?? fallback))
}

function resolveFilterCode(
  imageFilter: ImageFilterPreset,
  enabled: boolean
): number {
  if (!enabled) return 0
  switch (imageFilter) {
    case "vibrant-darkness":
      return 1
    case "moon-light":
      return 2
    case "overcast":
      return 3
    default:
      return 0
  }
}

function resolveSpotModeCode(mode: LightingMode | undefined): number {
  switch (mode) {
    case "spot":
      return 1
    case "scan-vertical":
      return 2
    case "scan-orbit":
      return 3
    case "dual-bands":
      return 4
    default:
      return 0
  }
}

interface RuntimeControls {
  animated: boolean
  playbackRate: number
  filterCode: number
  colorEnabled: boolean
  brightness: number
  contrast: number
  saturation: number
  hueShiftRad: number
  anchor: ReactiveSurfaceLayout
  zoomScale: number
  panX: number
  panY: number
  rotDeg: number
  tiltXDeg: number
  tiltYDeg: number
  flipX: boolean
  lightingEnabled: boolean
  ambientLevel: number
  spotModeCode: number
  spotCenterX: number
  spotCenterY: number
  spotRadius: number
  spotSoftness: number
  spotIntensity: number
  spotColorRgb: readonly [number, number, number]
}

/** Hover-lit and sway-animated Three.js canvas reproducing Wallpaper Engine's shaders, camera framing, and part lighting. */
export function ReactiveBackground({
  textureUrl,
  textureWidth,
  textureHeight,
  roughness,
  specularTint,
  swayMaskUrl,
  uvRect = DEFAULT_UV_RECT,
  metallic = 0,
  layout = "bottom-right",
  transparent = false,
  worldSpan = DEFAULT_WORLD_HEIGHT,
  animated = true,
  playbackRate = 100,
  viewOptions,
  lightingOptions,
  colorOptions,
  imageFilter = "none",
  imageFilterEnabled = true,
  className,
}: ReactiveBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  const uvX = uvRect[0]
  const uvY = uvRect[1]
  const uvW = uvRect[2]
  const uvH = uvRect[3]

  const brightnessVal = clampChannel(colorOptions?.brightness)
  const contrastVal = clampChannel(colorOptions?.contrast)
  const saturationVal = clampChannel(colorOptions?.saturation)
  const hueShiftVal = clampChannel(colorOptions?.hueShift)
  const colorActive =
    (colorOptions?.enabled ?? true) &&
    (brightnessVal !== 50 ||
      contrastVal !== 50 ||
      saturationVal !== 50 ||
      hueShiftVal !== 50)

  const viewActive = viewOptions?.enabled ?? true
  const resolvedAnchor: ReactiveSurfaceLayout = viewActive
    ? (viewOptions?.anchor ?? layout)
    : layout
  const zoomScale = viewActive
    ? clampRange(viewOptions?.zoom, 40, 300, 100) / 100
    : 1
  const panX = viewActive ? clampRange(viewOptions?.panX, -100, 100, 0) : 0
  const panY = viewActive ? clampRange(viewOptions?.panY, -100, 100, 0) : 0
  const rotDeg = viewActive
    ? clampRange(viewOptions?.rotation, -180, 180, 0)
    : 0
  const tiltXDeg = viewActive ? clampRange(viewOptions?.tiltX, -45, 45, 0) : 0
  const tiltYDeg = viewActive ? clampRange(viewOptions?.tiltY, -45, 45, 0) : 0
  const flipX = viewActive ? Boolean(viewOptions?.flipX) : false

  const lightingActive = lightingOptions?.enabled ?? true
  const ambientLevel = lightingActive
    ? clampRange(lightingOptions?.ambient, 0, 100, 100) / 100
    : 1
  const spotModeCode = lightingActive
    ? resolveSpotModeCode(lightingOptions?.mode)
    : 0
  const spotCenterX = clampRange(lightingOptions?.focusX, 0, 100, 54) / 100
  const spotCenterY = 1 - clampRange(lightingOptions?.focusY, 0, 100, 30) / 100
  const spotRadius = clampRange(lightingOptions?.radius, 10, 120, 42) / 100
  const spotSoftness = clampRange(lightingOptions?.softness, 10, 100, 65) / 100
  const spotIntensity = lightingActive
    ? clampRange(lightingOptions?.intensity, 0, 250, 125) / 100
    : 0
  const spotColorRgb = LIGHT_TINT_RGB[lightingOptions?.tint ?? "white"]

  const runtimeControls: RuntimeControls = {
    animated,
    playbackRate: Math.max(0, playbackRate),
    filterCode: resolveFilterCode(imageFilter, imageFilterEnabled),
    colorEnabled: colorActive,
    brightness: brightnessVal / 50,
    contrast: contrastVal / 50,
    saturation: saturationVal / 50,
    hueShiftRad: ((hueShiftVal - 50) / 50) * Math.PI,
    anchor: resolvedAnchor,
    zoomScale,
    panX,
    panY,
    rotDeg,
    tiltXDeg,
    tiltYDeg,
    flipX,
    lightingEnabled: lightingActive,
    ambientLevel,
    spotModeCode,
    spotCenterX,
    spotCenterY,
    spotRadius,
    spotSoftness,
    spotIntensity,
    spotColorRgb,
  }

  const runtimeRef = useRef<RuntimeControls>(runtimeControls)
  runtimeRef.current = runtimeControls

  const syncDisplayRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    syncDisplayRef.current?.()
  }, [
    animated,
    playbackRate,
    imageFilter,
    imageFilterEnabled,
    colorOptions?.enabled,
    colorOptions?.brightness,
    colorOptions?.contrast,
    colorOptions?.saturation,
    colorOptions?.hueShift,
    viewOptions?.enabled,
    viewOptions?.anchor,
    viewOptions?.zoom,
    viewOptions?.panX,
    viewOptions?.panY,
    viewOptions?.rotation,
    viewOptions?.tiltX,
    viewOptions?.tiltY,
    viewOptions?.flipX,
    lightingOptions?.enabled,
    lightingOptions?.ambient,
    lightingOptions?.mode,
    lightingOptions?.focusX,
    lightingOptions?.focusY,
    lightingOptions?.radius,
    lightingOptions?.softness,
    lightingOptions?.intensity,
    lightingOptions?.tint,
  ])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let rafId = 0
    let animating = false
    let swayMaskReady = false
    let swayTime = 0

    const textureAspect = textureWidth / textureHeight
    const planeHeight =
      layout === "contain-center"
        ? (textureHeight / Math.max(textureWidth, textureHeight)) * worldSpan
        : worldSpan
    const planeWidth = planeHeight * textureAspect

    const scene = new THREE.Scene()
    if (!transparent) {
      scene.background = new THREE.Color(0x000000)
    }

    const fovRad = (CAMERA_FOV_DEG * Math.PI) / 180
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 10, 20000)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: transparent,
        premultipliedAlpha: transparent,
        powerPreference: "high-performance",
      })
    } catch {
      return
    }

    if (transparent) {
      renderer.setClearColor(0x000000, 0)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.domElement.style.display = "block"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    container.appendChild(renderer.domElement)

    const initialControls = runtimeRef.current
    const uniforms = {
      uTexture: { value: null as THREE.Texture | null },
      uSwayMask: { value: null as THREE.Texture | null },
      uHasSwayMask: { value: 0.0 },
      uSwayStrength: {
        value: initialControls.animated ? SWAY_STRENGTH : 0.0,
      },
      uTime: { value: 0.0 },
      uUvRect: { value: new THREE.Vector4(uvX, uvY, uvW, uvH) },
      uFlipX: { value: initialControls.flipX ? 1.0 : 0.0 },
      uEdgeFade: { value: new THREE.Vector2(0.0, 0.0) },
      uCameraPos: { value: new THREE.Vector3(0, 0, DEFAULT_WORLD_HEIGHT) },
      uTexAspect: { value: textureAspect },
      uRoughness: { value: roughness },
      uMetallic: { value: metallic },
      uTransparent: { value: transparent ? 1.0 : 0.0 },
      uSpecularTint: {
        value: new THREE.Vector3(specularTint, specularTint, specularTint),
      },
      uAmbientColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
      uLightColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
      uLightPos: { value: new THREE.Vector3(0, 0, LIGHT_Z) },
      uLightIntensity: { value: 0.0 },
      uLightRadius: { value: LIGHT_RADIUS },
      uLightExponent: { value: LIGHT_EXPONENT },
      uLightingEnabled: { value: initialControls.lightingEnabled ? 1.0 : 0.0 },
      uAmbientLevel: { value: initialControls.ambientLevel },
      uSpotMode: { value: initialControls.spotModeCode },
      uSpotCenterUv: {
        value: new THREE.Vector2(
          initialControls.spotCenterX,
          initialControls.spotCenterY
        ),
      },
      uSpotRadius: { value: initialControls.spotRadius },
      uSpotSoftness: { value: initialControls.spotSoftness },
      uSpotIntensity: { value: initialControls.spotIntensity },
      uSpotColor: {
        value: new THREE.Vector3(
          initialControls.spotColorRgb[0],
          initialControls.spotColorRgb[1],
          initialControls.spotColorRgb[2]
        ),
      },
      uImageFilter: { value: initialControls.filterCode },
      uColorEnabled: { value: initialControls.colorEnabled ? 1.0 : 0.0 },
      uBrightness: { value: initialControls.brightness },
      uContrast: { value: initialControls.contrast },
      uSaturation: { value: initialControls.saturation },
      uHueShift: { value: initialControls.hueShiftRad },
    }

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight)
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent,
      premultipliedAlpha: transparent,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.order = "YXZ"
    mesh.visible = false
    scene.add(mesh)

    let worldW = planeWidth
    let worldH = planeHeight

    const applyMeshTransform = () => {
      const controls = runtimeRef.current
      const scaledW = planeWidth * controls.zoomScale
      const scaledH = planeHeight * controls.zoomScale

      let baseX = 0
      let baseY = 0
      if (controls.anchor === "bottom-right") {
        baseX = worldW / 2 - scaledW / 2
        baseY = -worldH / 2 + scaledH / 2
      } else if (controls.anchor === "bottom-left") {
        baseX = -worldW / 2 + scaledW / 2
        baseY = -worldH / 2 + scaledH / 2
      } else if (controls.anchor === "top-center") {
        baseX = 0
        baseY = worldH / 2 - scaledH / 2
      }

      const offsetX = (controls.panX / 100) * worldW * 0.6
      const offsetY = (controls.panY / 100) * worldH * 0.6
      mesh.position.set(baseX + offsetX, baseY + offsetY, 0)
      mesh.scale.set(controls.zoomScale, controls.zoomScale, 1)
      mesh.rotation.set(
        (controls.tiltXDeg * Math.PI) / 180,
        (controls.tiltYDeg * Math.PI) / 180,
        (-controls.rotDeg * Math.PI) / 180
      )

      const rightFlush =
        !controls.flipX &&
        controls.anchor === "bottom-right" &&
        Math.abs(controls.panX) < 1 &&
        Math.abs(controls.panY) < 1 &&
        Math.abs(controls.rotDeg) < 1 &&
        Math.abs(controls.tiltXDeg) < 1 &&
        Math.abs(controls.tiltYDeg) < 1 &&
        controls.zoomScale >= 0.99

      const bottomMoved =
        Math.abs(controls.rotDeg) > 1 ||
        Math.abs(controls.tiltXDeg) > 1 ||
        controls.anchor === "center" ||
        controls.anchor === "top-center" ||
        controls.panY > 1 ||
        controls.zoomScale < 0.99

      if (transparent) {
        uniforms.uEdgeFade.value.set(0.0, 0.0)
      } else {
        uniforms.uEdgeFade.value.set(
          rightFlush ? 0.0 : 0.075,
          bottomMoved ? 0.035 : 0.0
        )
      }
    }

    const updateViewport = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      const viewportAspect = width / height

      renderer.setSize(width, height, false)

      if (viewportAspect >= textureAspect) {
        worldH = planeHeight
        worldW = worldH * viewportAspect
      } else {
        worldW = planeWidth
        worldH = worldW / viewportAspect
      }

      const camDist = worldH / (2 * Math.tan(fovRad / 2))
      camera.fov = CAMERA_FOV_DEG
      camera.aspect = viewportAspect
      camera.near = Math.max(10, camDist * 0.05)
      camera.far = camDist * 5 + 4000
      camera.position.set(0, 0, camDist)
      camera.updateProjectionMatrix()
      uniforms.uCameraPos.value.set(0, 0, camDist)

      applyMeshTransform()
    }

    updateViewport()

    let hasPointer = false
    let hovered = false
    let targetX = 0
    let targetY = 0
    let targetZ = LIGHT_Z
    let currentX = 0
    let currentY = 0
    let currentZ = LIGHT_Z
    let targetIntensity = 0
    let currentIntensity = 0
    let lastTime = performance.now()
    const planeNormal = new THREE.Vector3(0, 0, 1)
    const rayDir = new THREE.Vector3()
    const toPlane = new THREE.Vector3()

    const applyRuntimeUniforms = () => {
      const controls = runtimeRef.current
      uniforms.uSwayStrength.value = controls.animated ? SWAY_STRENGTH : 0.0
      uniforms.uFlipX.value = controls.flipX ? 1.0 : 0.0
      uniforms.uLightingEnabled.value = controls.lightingEnabled ? 1.0 : 0.0
      uniforms.uAmbientLevel.value = controls.ambientLevel
      uniforms.uSpotMode.value = controls.spotModeCode
      uniforms.uSpotCenterUv.value.set(
        controls.spotCenterX,
        controls.spotCenterY
      )
      uniforms.uSpotRadius.value = controls.spotRadius
      uniforms.uSpotSoftness.value = controls.spotSoftness
      uniforms.uSpotIntensity.value = controls.spotIntensity
      uniforms.uSpotColor.value.set(
        controls.spotColorRgb[0],
        controls.spotColorRgb[1],
        controls.spotColorRgb[2]
      )
      uniforms.uImageFilter.value = controls.filterCode
      uniforms.uColorEnabled.value = controls.colorEnabled ? 1.0 : 0.0
      uniforms.uBrightness.value = controls.brightness
      uniforms.uContrast.value = controls.contrast
      uniforms.uSaturation.value = controls.saturation
      uniforms.uHueShift.value = controls.hueShiftRad
      applyMeshTransform()
    }

    const isAnimatedLightRunning = () =>
      runtimeRef.current.lightingEnabled && runtimeRef.current.spotModeCode >= 2

    const isMotionRunning = () =>
      (swayMaskReady || isAnimatedLightRunning()) &&
      runtimeRef.current.animated &&
      runtimeRef.current.playbackRate > 0

    const renderFrame = (now: number) => {
      rafId = 0
      if (disposed) return

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000))
      lastTime = now

      const posFactor = 1 - Math.exp(-18 * dt)
      const intensityFactor = 1 - Math.exp(-12 * dt)

      currentX += (targetX - currentX) * posFactor
      currentY += (targetY - currentY) * posFactor
      currentZ += (targetZ - currentZ) * posFactor
      currentIntensity += (targetIntensity - currentIntensity) * intensityFactor

      uniforms.uLightPos.value.set(currentX, currentY, currentZ)
      uniforms.uLightIntensity.value = currentIntensity

      const motionActive = isMotionRunning()
      if (motionActive) {
        swayTime += dt * (runtimeRef.current.playbackRate / 100)
        uniforms.uTime.value = swayTime
      }

      renderer.render(scene, camera)

      const hoverSettled =
        Math.abs(targetX - currentX) < 0.25 &&
        Math.abs(targetY - currentY) < 0.25 &&
        Math.abs(targetZ - currentZ) < 0.25 &&
        Math.abs(targetIntensity - currentIntensity) < 0.005

      if (!hoverSettled || motionActive) {
        rafId = requestAnimationFrame(renderFrame)
      } else {
        currentX = targetX
        currentY = targetY
        currentZ = targetZ
        currentIntensity = targetIntensity
        uniforms.uLightPos.value.set(currentX, currentY, currentZ)
        uniforms.uLightIntensity.value = currentIntensity
        renderer.render(scene, camera)
        animating = false
      }
    }

    const startAnimating = () => {
      if (disposed || !mesh.visible || animating) return
      animating = true
      lastTime = performance.now()
      rafId = requestAnimationFrame(renderFrame)
    }

    syncDisplayRef.current = () => {
      applyRuntimeUniforms()
      if (!mesh.visible || disposed) return
      if (isMotionRunning() || hovered) {
        startAnimating()
      } else {
        renderer.render(scene, camera)
      }
    }

    const updatePointerTarget = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const nx = (clientX - rect.left) / rect.width
      const ny = (clientY - rect.top) / rect.height
      const wx = (nx - 0.5) * worldW
      const wy = (0.5 - ny) * worldH

      planeNormal.set(0, 0, 1).applyEuler(mesh.rotation).normalize()
      rayDir.set(wx, wy, -camera.position.z)
      toPlane.subVectors(mesh.position, camera.position)
      const denom = rayDir.dot(planeNormal)
      let lx = wx
      let ly = wy
      let lz = LIGHT_Z
      if (Math.abs(denom) > 0.001) {
        const hitT = toPlane.dot(planeNormal) / denom
        lx = camera.position.x + rayDir.x * hitT + planeNormal.x * LIGHT_Z
        ly = camera.position.y + rayDir.y * hitT + planeNormal.y * LIGHT_Z
        lz = camera.position.z + rayDir.z * hitT + planeNormal.z * LIGHT_Z
      }

      targetX = lx
      targetY = ly
      targetZ = lz
      if (!hasPointer) {
        currentX = lx
        currentY = ly
        currentZ = lz
        hasPointer = true
      }
      hovered = true
      targetIntensity = LIGHT_INTENSITY
      startAnimating()
    }

    const handlePointerMove = (e: PointerEvent) => {
      updatePointerTarget(e.clientX, e.clientY)
    }

    const handlePointerEnter = (e: PointerEvent) => {
      updatePointerTarget(e.clientX, e.clientY)
    }

    const handlePointerLeave = () => {
      hovered = false
      targetIntensity = 0
      startAnimating()
    }

    container.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    })
    container.addEventListener("pointerenter", handlePointerEnter, {
      passive: true,
    })
    container.addEventListener("pointerleave", handlePointerLeave, {
      passive: true,
    })

    const handleContextLost = (e: Event) => {
      e.preventDefault()
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      animating = false
    }

    const handleContextRestored = () => {
      if (!disposed && mesh.visible) {
        renderer.render(scene, camera)
        if (hovered || isMotionRunning()) startAnimating()
      }
    }

    renderer.domElement.addEventListener("webglcontextlost", handleContextLost)
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      handleContextRestored
    )

    const resizeObserver = new ResizeObserver(() => {
      updateViewport()
      if (mesh.visible) {
        renderer.render(scene, camera)
        if (hovered || isMotionRunning()) startAnimating()
      }
    })
    resizeObserver.observe(container)

    const textureLoader = new THREE.TextureLoader()
    const texture = textureLoader.load(textureUrl, (loadedTexture) => {
      if (disposed) {
        loadedTexture.dispose()
        return
      }
      loadedTexture.colorSpace = THREE.NoColorSpace
      loadedTexture.minFilter = THREE.LinearMipmapLinearFilter
      loadedTexture.magFilter = THREE.LinearFilter
      loadedTexture.generateMipmaps = true
      loadedTexture.wrapS = THREE.ClampToEdgeWrapping
      loadedTexture.wrapT = THREE.ClampToEdgeWrapping
      loadedTexture.needsUpdate = true

      uniforms.uTexture.value = loadedTexture
      applyRuntimeUniforms()
      mesh.visible = true
      renderer.render(scene, camera)
      setReady(true)
      if (hovered || isMotionRunning()) startAnimating()
    })

    let swayMaskTexture: THREE.Texture | null = null
    if (swayMaskUrl) {
      swayMaskTexture = textureLoader.load(swayMaskUrl, (loadedMask) => {
        if (disposed) {
          loadedMask.dispose()
          return
        }
        loadedMask.colorSpace = THREE.NoColorSpace
        loadedMask.minFilter = THREE.LinearFilter
        loadedMask.magFilter = THREE.LinearFilter
        loadedMask.generateMipmaps = false
        loadedMask.wrapS = THREE.ClampToEdgeWrapping
        loadedMask.wrapT = THREE.ClampToEdgeWrapping
        loadedMask.needsUpdate = true

        uniforms.uSwayMask.value = loadedMask
        uniforms.uHasSwayMask.value = 1.0
        swayMaskReady = true

        if (mesh.visible) {
          if (isMotionRunning() || hovered) {
            startAnimating()
          } else {
            renderer.render(scene, camera)
          }
        }
      })
    }

    return () => {
      disposed = true
      syncDisplayRef.current = null
      if (rafId) cancelAnimationFrame(rafId)
      resizeObserver.disconnect()
      container.removeEventListener("pointermove", handlePointerMove)
      container.removeEventListener("pointerenter", handlePointerEnter)
      container.removeEventListener("pointerleave", handlePointerLeave)
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        handleContextLost
      )
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        handleContextRestored
      )
      scene.remove(mesh)
      geometry.dispose()
      material.dispose()
      texture.dispose()
      swayMaskTexture?.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [
    textureUrl,
    textureWidth,
    textureHeight,
    swayMaskUrl,
    uvX,
    uvY,
    uvW,
    uvH,
    roughness,
    metallic,
    specularTint,
    layout,
    transparent,
    worldSpan,
  ])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden transition-opacity duration-300 select-none",
        transparent ? "size-full" : "h-full w-full bg-black",
        className,
        ready ? "opacity-100" : "opacity-0"
      )}
    />
  )
}
