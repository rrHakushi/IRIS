# Profile Customization & Display Name Styling

> **Source File:** `plugins/akaromi-firefox/popup/js/customization.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`popup/js/customization.js` renders user profile typography, gradient styles, and avatar frames matching the IRIS web ecosystem.

---

## Features
- **Font Presets:** Embedded typography definitions (`Inter`, `JetBrains Mono`, `Orbitron`, `Cinzel`, `Playfair Display`, `Press Start 2P`, etc.).
- **Media URL Resolution:** Resolves absolute avatar URLs against configured IRIS server origins.
- **Display Name Rendering:** Renders custom gradient styles and badges.

---

## Step-by-Step Architecture

### ***Step 1***: Typography Presets & Asset Resolution

#### **Step 1.1**: Embedded Font Family Presets & Media URL Resolution
- `FONT_PRESETS`: Array of font definitions.
- `resolveMediaUrl(url, serverUrl)`: Converts relative paths to full server URLs.

---

### ***Step 2***: User Customization & Display Name Styling

#### **Step 2.1**: Custom Gradient Colors, Fonts & Avatar Frames
`renderDisplayName(user, container)`: Applies custom font families, gradient colors, and effects to user profile representations.
