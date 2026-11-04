# Interactive In-Input Floating Badge Widget

> **Source File:** `plugins/akaromi-firefox/content/badge.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`content/badge.js` renders and positions the interactive Akaromi badge inside credential input fields when focused.

---

## Features
- **Focus-Activated Display:** Badge appears only when field is actively focused.
- **Eye-Button Collision Avoidance:** Automatically offsets badge to the left of existing password reveal icons.
- **Absolute Viewport Tracking:** Tracks field position during page scrolling and layout changes.

---

## Step-by-Step Architecture

### ***Step 1***: In-Input Floating Badge Construction

#### **Step 1.1**: Badge DOM Creation & Event Suppression
`createBadgeElement(input)`: Creates badge with Akaromi SVG icon and prevents focus loss on click.

---

### ***Step 2***: Trailing Button Collision Avoidance & Absolute Positioning

#### **Step 2.1**: Native Eye Icon Collision Detection & Viewport Tracking
`getTrailingButtonOffset(input, icon, rect)`: Measures input padding and detects native/custom reveal buttons, shifting badge position to avoid overlap.
`updateIconPosition(input, icon)`: Positions badge precisely inside the field boundary.

---

### ***Step 3***: Input Focus Event Binding & Menu Triggers

#### **Step 3.1**: Attaching Badge to Qualified Input
`attachInputBadge(input)`: Binds focus and blur events. Clicking badge opens the floating autofill menu.
