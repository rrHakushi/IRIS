# IRIS Design System & UI Specification

> **Site Design Guide**: shadcn UI (`aria-rhea` style) with Mauve base, Rose theme accent, Red chart palette, and Tabler Icons.
> Clean, default shadcn aesthetic with zero unnecessary visual bloat.

---

## 1. Overview & Design Philosophy

The IRIS web application implements a refined, modern design system built on top of **shadcn/ui** with the **aria-rhea** variant style, **Tailwind CSS v4**, and **React Aria Components**.

### Core Pillars
1. **Clean Default Look**: Purpose-driven, minimalist presentation. Clean surfaces, crisp 1px borders, subtle glass/translucent overlays, and zero decorative noise.
2. **Accessible & Keyboard-First**: Powered by React Aria Components primitives (`react-aria-components`), providing full WAI-ARIA compliance, screen reader support, and native focus rings.
3. **Bi-directional (RTL/LTR)**: First-class Right-to-Left (RTL) localization support with CSS logical properties (`ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`).
4. **Perceptually Uniform Color (OKLCH)**: High dynamic range color definitions with smooth perceptual gradations across Light and Dark themes.

---

## 2. Configuration (`components.json`)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "aria-rhea",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "../../packages/ui/src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "tabler",
  "aliases": {
    "components": "@/components",
    "hooks": "@/hooks",
    "lib": "@/lib",
    "utils": "@workspace/ui/lib/utils",
    "ui": "@workspace/ui/components"
  },
  "rtl": true,
  "menuColor": "default-translucent",
  "menuAccent": "subtle"
}
```

### Key Settings
- **Style (`aria-rhea`)**: Integrates React Aria Components primitives with rounded pill/soft-curved geometric components (`rounded-2xl` buttons/badges, soft container cards).
- **Icon Library (`tabler`)**: `@tabler/icons-react` icons styled with `size-4` default metrics and consistent stroke widths.
- **RTL (`rtl: true`)**: Configured for multilingual and bidirectional rendering out of the box.
- **Menu System (`menuColor: "default-translucent"`, `menuAccent: "subtle"`)**: Subtle translucent floating surfaces with understated hover accents.

---

## 3. Color System (OKLCH)

The color palette is built around three foundational pillars:
1. **Mauve Base**: Cool, slate-mauve tinted neutrals providing subtle depth over sterile grays.
2. **Rose Theme Accent**: Vibrant, modern rose tones for primary actions, focus rings, and highlights.
3. **Red Chart Palette**: 5-step monochromatic crimson/ruby scale for data visualizations and metrics.

### 3.1 Token Definitions

| Token | Light Theme (`:root`) | Dark Theme (`.dark`) | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(1 0 0)` | `oklch(0.145 0.008 326)` | Page background canvas |
| `--foreground` | `oklch(0.145 0.008 326)` | `oklch(0.985 0 0)` | Primary body typography |
| `--card` | `oklch(1 0 0)` | `oklch(0.212 0.019 322.12)` | Elevated surface containers |
| `--card-foreground` | `oklch(0.145 0.008 326)` | `oklch(0.985 0 0)` | Card typography |
| `--popover` | `oklch(1 0 0)` | `oklch(0.212 0.019 322.12)` | Dropdowns, menus, floating dialogs |
| `--popover-foreground` | `oklch(0.145 0.008 326)` | `oklch(0.985 0 0)` | Popover typography |
| `--primary` | `oklch(0.514 0.222 16.935)` | `oklch(0.455 0.188 13.697)` | **Rose Accent** — Primary CTAs, active states |
| `--primary-foreground` | `oklch(0.969 0.015 12.422)` | `oklch(0.969 0.015 12.422)` | Text/icons on primary surfaces |
| `--secondary` | `oklch(0.967 0.001 286.375)` | `oklch(0.274 0.006 286.033)` | Secondary action buttons & chips |
| `--secondary-foreground`| `oklch(0.21 0.006 285.885)` | `oklch(0.985 0 0)` | Text on secondary surfaces |
| `--muted` | `oklch(0.96 0.003 325.6)` | `oklch(0.263 0.024 320.12)` | Subtle backgrounds, table header bars |
| `--muted-foreground` | `oklch(0.542 0.034 322.5)` | `oklch(0.711 0.019 323.02)` | Subtitles, helper text, placeholders |
| `--accent` | `oklch(0.96 0.003 325.6)` | `oklch(0.263 0.024 320.12)` | Hover states for list/menu items |
| `--accent-foreground` | `oklch(0.212 0.019 322.12)` | `oklch(0.985 0 0)` | Text on accent hover |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Errors, alerts, delete actions |
| `--border` | `oklch(0.922 0.005 325.62)` | `oklch(1 0 0 / 10%)` | Default component & separator borders |
| `--input` | `oklch(0.922 0.005 325.62)` | `oklch(1 0 0 / 15%)` | Input control field borders & surfaces |
| `--ring` | `oklch(0.711 0.019 323.02)` | `oklch(0.542 0.034 322.5)` | Focus indicator rings |

---

### 3.2 Red Chart Colors Palette

A cohesive 5-tier red spectrum for charts, visualizations, and status meters:

| Variable | OKLCH Value | Visual Tone | Recommended Use |
| :--- | :--- | :--- | :--- |
| `--chart-1` | `oklch(0.808 0.114 19.571)` | Soft Light Coral Rose | Primary metrics, trend lines |
| `--chart-2` | `oklch(0.637 0.237 25.331)` | Vivid Rose Red | Secondary comparison series |
| `--chart-3` | `oklch(0.577 0.245 27.325)` | Deep Ruby Red | Tertiary series, active bars |
| `--chart-4` | `oklch(0.505 0.213 27.518)` | Rich Crimson Bordeaux | Quaternary series, area fills |
| `--chart-5` | `oklch(0.444 0.177 26.899)` | Dark Cherry Wine | Background bars, low-light comparison |

```css
/* Inline theme aliases for chart tokens */
--color-chart-1: var(--chart-1);
--color-chart-2: var(--chart-2);
--color-chart-3: var(--chart-3);
--color-chart-4: var(--chart-4);
--color-chart-5: var(--chart-5);
```

---

### 3.3 Sidebar Color Palette

Dedicated sidebar tokens ensure consistent navigation surfaces distinct from standard cards:

| Token | Light Theme | Dark Theme |
| :--- | :--- | :--- |
| `--sidebar` | `oklch(0.985 0 0)` | `oklch(0.21 0.006 285.885)` |
| `--sidebar-foreground` | `oklch(0.145 0.008 326)` | `oklch(0.985 0 0)` |
| `--sidebar-primary` | `oklch(0.586 0.253 17.585)` | `oklch(0.645 0.246 16.439)` |
| `--sidebar-primary-foreground` | `oklch(0.969 0.015 12.422)` | `oklch(0.969 0.015 12.422)` |
| `--sidebar-accent` | `oklch(0.96 0.003 325.6)` | `oklch(0.263 0.024 320.12)` |
| `--sidebar-accent-foreground` | `oklch(0.212 0.019 322.12)` | `oklch(0.985 0 0)` |
| `--sidebar-border` | `oklch(0.922 0.005 325.62)` | `oklch(1 0 0 / 10%)` |
| `--sidebar-ring` | `oklch(0.711 0.019 323.02)` | `oklch(0.542 0.034 322.5)` |

---

## 4. Typography

The typographic hierarchy pairs high-precision geometric headings with highly legible, humanistic sans-serif body copy.

### 4.1 Font Families

| Role | Family | Variable | Target Usage |
| :--- | :--- | :--- | :--- |
| **Heading** | `Oxanium` | `--font-heading` | Page titles, card headings, stat values, modal headers |
| **Body & UI** | `Instrument Sans` | `--font-sans` | Body text, labels, button text, menu items |
| **Monospace** | `Geist Mono` | `--font-mono` | Code blocks, API keys, hashes, logs, numeric tabular data |

### 4.2 Type Scale & Hierarchy

| Element | Font Family | Size | Weight | Tailwind Classes |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title (H1)** | Oxanium | `1.75rem - 2.25rem` | `600` / SemiBold | `font-heading text-2xl md:text-3xl font-semibold tracking-tight` |
| **Section Title (H2)**| Oxanium | `1.25rem - 1.5rem` | `600` / SemiBold | `font-heading text-xl md:text-2xl font-semibold` |
| **Card Title (H3)** | Oxanium | `1.0rem - 1.125rem` | `500` / Medium | `font-heading text-base font-medium` |
| **Subtitles / Descriptors** | Instrument Sans | `0.875rem` | `400` / Regular | `text-sm text-muted-foreground` |
| **Body (Default)** | Instrument Sans | `0.875rem` | `400` / Regular | `text-sm text-foreground leading-relaxed` |
| **Microcopy / Badges**| Instrument Sans | `0.75rem` | `500` / Medium | `text-xs font-medium` |
| **Mono / Code** | Geist Mono | `0.8125rem` | `400` / Regular | `font-mono text-xs` |

---

## 5. Geometry, Radius & Spacing

### 5.1 Radius Scale
The Rhea variant style features softly rounded geometry:

```css
--radius: 0.45rem;
--radius-sm: calc(var(--radius) * 0.6);   /* ~0.27rem / 4.3px */
--radius-md: calc(var(--radius) * 0.8);   /* ~0.36rem / 5.7px */
--radius-lg: var(--radius);                /* ~0.45rem / 7.2px */
--radius-xl: calc(var(--radius) * 1.4);   /* ~0.63rem / 10px */
--radius-2xl: calc(var(--radius) * 1.8);  /* ~0.81rem / 13px */
--radius-3xl: calc(var(--radius) * 2.2);  /* ~0.99rem / 16px */
--radius-4xl: calc(var(--radius) * 2.6);  /* ~1.17rem / 18.7px */
```

### 5.2 Component Radius Rules
- **Buttons, Badges, Input Controls, Switches**: `rounded-2xl`
- **Cards**: `rounded-[min(var(--radius-4xl),24px)]`
- **Sidebar Menu Items & Group Labels**: `rounded-xl`
- **Dropdowns & Popovers**: `rounded-2xl` with `shadow-md`

---

## 6. Iconography: Tabler Icons

Icons are sourced from `@tabler/icons-react`.

### 6.1 Sizing Guidelines

| Context | Class | Pixel Size | Stroke Width |
| :--- | :--- | :--- | :--- |
| **Micro / Inside Badges & Small Inputs** | `size-3` | 12px | 1.5 – 2 |
| **Standard (Buttons, Menus, Nav Items)** | `size-4` | 16px | 2 |
| **Medium (Action Buttons, Form Headers)**| `size-5` | 20px | 1.5 – 2 |
| **Feature / Hero / Empty State** | `size-8` - `size-10` | 32px – 40px | 1.5 |

### 6.2 Icon Alignment & Directionality
- Button inline icons use logical margins: `has-data-[icon=inline-start]:ps-2.5` and `has-data-[icon=inline-end]:pe-2.5`.
- Never use hardcoded directional icons for navigational arrows when RTL is active; use logical flipping or localized icon variants.

---

## 7. Component Style Patterns

### 7.1 Buttons (`@workspace/ui/components/button`)
- **Base**: `rounded-2xl border border-transparent text-sm font-medium transition-all`
- **Focus Ring**: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30`
- **Variants**:
  - `default`: `bg-primary text-primary-foreground hover:bg-primary/80`
  - `outline`: `border-border bg-background hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-input/30`
  - `secondary`: `bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]`
  - `ghost`: `hover:bg-muted hover:text-foreground dark:hover:bg-muted/50`
  - `destructive`: `bg-destructive/10 text-destructive hover:bg-destructive/20`
  - `link`: `text-primary underline-offset-4 hover:underline`
- **Sizes**: `xs` (h-6), `sm` (h-7), `default` (h-8), `lg` (h-9), `icon`, `icon-xs`, `icon-sm`, `icon-lg`

### 7.2 Cards (`@workspace/ui/components/card`)
- **Container**: `rounded-[min(var(--radius-4xl),24px)] bg-card text-card-foreground shadow-sm ring-1 ring-foreground/5 dark:ring-foreground/10`
- **Spacing Token**: `[--card-spacing:--spacing(5)]` (compact: `[--card-spacing:--spacing(4)]`)
- **Header**: Container-query aware (`@container/card-header`) with automatic grid realignment when `CardAction` is present (`has-data-[slot=card-action]:grid-cols-[1fr_auto]`).
- **Title**: `font-heading text-base font-medium`

### 7.3 Badges (`@workspace/ui/components/badge`)
- **Base**: `rounded-2xl border border-transparent h-5 px-2 py-0.5 text-xs font-medium`
- **Variants**: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`

### 7.4 Form Inputs & Controls
- **Input (`@workspace/ui/components/input`)**: `h-8 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30`
- **Switch (`@workspace/ui/components/switch`)**: `h-5 w-8 rounded-2xl` with sliding indicator thumb (`data-selected:translate-x-[calc(100%-4px)] rtl:data-selected:-translate-x-[calc(100%-4px)]`).
- **Validation**:
  - Invalid state: `aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40`

### 7.5 Sidebar (`@workspace/ui/components/sidebar`)
- **Widths**: Desktop `16rem`, Mobile `18rem`, Collapsed Icon `3rem`.
- **Item Styling**: `rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium`.
- **Keyboard Shortcut**: `Ctrl/Cmd + B` toggle support.

---

## 8. Layer & Base Styles

```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  button:not(:disabled), [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}
```

### Global Selection
Text selection highlights use the Rose theme accent:
```html
<body className="min-h-svh bg-background text-foreground selection:bg-primary/20 selection:text-primary">
```

---

## 9. Development Guidelines & Checklist

### Do's
- Use semantic token classes (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`) instead of arbitrary colors or raw hex values.
- Use `Oxanium` (`font-heading`) for titles, modal headings, and cards.
- Use Tabler Icons with `size-4` for standard buttons and navigation links.
- Use logical CSS utilities (`ps-3`, `pe-3`, `ms-2`, `me-2`, `text-start`, `text-end`) to guarantee proper RTL alignment.
- Keep the clean shadcn look: avoid unnecessary heavy borders, excessive shadows, or decorative gradients unless required for specific illustrations.

### Don'ts
- Do not introduce arbitrary color variables outside the Mauve neutral, Rose primary, and Red chart palette.
- Do not mix Lucide or FontAwesome icons; use `@tabler/icons-react` exclusively.
- Do not override component border-radii with square or sharp corners (`rounded-none` / `rounded-sm`) unless deliberately building code viewports.
- Do not use hardcoded `left-*` / `right-*` positioning for directional UI elements.
