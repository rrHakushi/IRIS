---
name: iris-banners
description: 'Generate standard OpenGraph and social media banner images (1200x630, solid #000000 pure black background, Solo Leveling glitch typography) for IRIS applications and wire Next.js metadata. Use whenever adding or updating OpenGraph/Twitter banners, creating a new app in the IRIS ecosystem, fixing social preview cards (Twitter, Facebook, Google SERP), or regenerating public banner assets.'
compatibility: 'Requires Python 3 with Pillow (PIL) and a serif display font (NotoSerifDisplay-Medium or fallback serif).'
allowed-tools: shell(python3:*)
---

# IRIS Banners & Social OpenGraph Images

Guidance and automation for creating and maintaining text-only, dark aesthetic OpenGraph banner images ($1200 \times 630$) for all IRIS applications, along with wiring their Next.js App Router metadata.

---

## 1. Architectural Rules & Asset Location

- **Storage Location**: All banner images **MUST** be placed exclusively in:
  ```text
  apps/web/public/banners/<app-id>.png
  ```
- **Strict Prohibition**: **NEVER** place image files (such as `opengraph-image.png` or `twitter-image.png`) inside route directories (`apps/web/app/(APPS)/*`). All routes refer to static assets via public URL `/banners/<app-id>.png`.
- **Dimensions**: **$1200 \times 630$** pixels ($1.91:1$ aspect ratio). This standard size eliminates letter cropping on Twitter `summary_large_image` and Facebook/LinkedIn cards, while serving as a sharp square/landscape thumbnail on Google SERP previews.

---

## 2. Visual Design Specification

- **Background**: Solid pure black `#000000` (`rgb(0, 0, 0)`). No gradients, no gray tones, no character art, no hair strands.
- **Content**: Text-only, uppercase application title (e.g. `AKAROMI`, `TESSERACT`, `BOREALIS`).
- **Typography**: Solo Leveling-inspired glitch serif:
  - Font: `NotoSerifDisplay-Medium` (`/usr/share/fonts/noto/NotoSerifDisplay-Medium.ttf` or fallback serif).
  - Font Size: $84\text{px}$.
  - Tracking (character spacing):
    - Short words ($\le 4$ chars): `48px`
    - Medium words ($5-7$ chars): `40px`
    - Long words ($\ge 8$ chars): `34px`
- **Glitch & Glow Effects**:
  - Horizontal slice displacements across the text block ($+5\text{px}$, $-6\text{px}$, $+5\text{px}$, $-4\text{px}$, $+4\text{px}$).
  - Horizontal needle spurs protruding past letter edges.
  - Sub-pixel horizontal micro-slits cut into glyphs.
  - Dual diffuse glow: $8\text{px}$ wide gaussian blur + $2\text{px}$ tight gaussian blur.

---

## 3. Generating Banners via Bundled CLI

Use the bundled generator script located at `.agents/skills/iris-banners/scripts/generate_banner.py`.

### Generate a Single App Banner
```bash
python3 .agents/skills/iris-banners/scripts/generate_banner.py "Akaromi" --id "akaromi"
```
*Outputs to `apps/web/public/banners/akaromi.png` ($1200 \times 630$).*

### Custom Destination
```bash
python3 .agents/skills/iris-banners/scripts/generate_banner.py "My New App" -o apps/web/public/banners/mynewapp.png
```

### Regenerate All 13 Suite Apps
```bash
python3 .agents/skills/iris-banners/scripts/generate_banner.py --all
```

---

## 4. Next.js App Router Metadata Wiring

In the app's root layout (`apps/web/app/(APPS)/<app-id>/layout.tsx`), configure `Metadata`:

```tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "AppName | Description",
    template: "%s | AppName",
  },
  description: "Short informative description of the application.",
  openGraph: {
    title: "AppName | Description",
    description: "Short informative description of the application.",
    siteName: "IRIS",
    images: [
      {
        url: "/banners/<app-id>.png",
        width: 1200,
        height: 630,
        alt: "AppName",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AppName | Description",
    description: "Short informative description of the application.",
    images: ["/banners/<app-id>.png"],
  },
}
```

Ensure `metadataBase` is defined on the root layout (`apps/web/app/layout.tsx`):
```tsx
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  // ...
}
```

---

## 5. Canonical IRIS Ecosystem Apps

| App ID | Display Title | Public Asset Path |
| :--- | :--- | :--- |
| `akaromi` | AKAROMI | `/banners/akaromi.png` |
| `borealis` | BOREALIS | `/banners/borealis.png` |
| `kiroshi` | KIROSHI | `/banners/kiroshi.png` |
| `carina` | CARINA | `/banners/carina.png` |
| `apertune` | APERTUNE | `/banners/apertune.png` |
| `reliquary` | RELIQUARY | `/banners/reliquary.png` |
| `spica` | SPICA | `/banners/spica.png` |
| `astra` | ASTRA | `/banners/astra.png` |
| `amadeus` | AMADEUS | `/banners/amadeus.png` |
| `vex` | VEX | `/banners/vex.png` |
| `nyxis` | NYXIS | `/banners/nyxis.png` |
| `lynx` | LYNX | `/banners/lynx.png` |
| `tesseract` | TESSERACT | `/banners/tesseract.png` |

