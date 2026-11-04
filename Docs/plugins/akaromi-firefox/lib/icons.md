# Tabler SVG Vector Icon Repository

> **Source File:** `plugins/akaromi-firefox/lib/icons.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `IrisIcons`  

---

## Overview
`lib/icons.js` provides standardized Tabler SVG vector icons across the extension popup, inline floating badges, and dialog overlays without external network calls.

---

## Features
- **Zero Network Dependencies:** Clean SVG path strings embedded directly in memory.
- **Tabler Icon Standard:** 100% compliant with IRIS project design system.
- **Dynamic DOM Rendering:** Helper methods to construct styled `<svg>` DOM nodes.

---

## Step-by-Step Architecture

### ***Step 1***: Tabler SVG Vector Dictionary

#### **Step 1.1**: Action, Visibility, Security & Item Type Icons
Dictionary of path strings:
- Actions: `plus`, `x`, `check`, `trash`, `edit`, `copy`, `refresh`.
- Visibility: `eye`, `eye-off`.
- Security: `key`, `lock`, `shield`, `fingerprint`, `qr`.
- Types: `login`, `card`, `note`, `ssh`, `identity`, `world`.

---

### ***Step 2***: Dynamic SVG DOM Construction

#### **Step 2.1**: SVG Element Creation with Dynamic Sizing & Styling
- `getIconSvg(name, size, className)`: Generates raw SVG markup.
- `createIcon(name, size, className)`: Instantiates SVG DOM elements for injection into content scripts.
