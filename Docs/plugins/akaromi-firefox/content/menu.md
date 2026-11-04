# In-Page Floating Autofill Menu & Instant Search

> **Source File:** `plugins/akaromi-firefox/content/menu.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`content/menu.js` renders the floating autofill dropdown, supporting syntax filtering, tiered domain grouping, inline vault searching, and one-click filling.

---

## Features
- **Syntax Prefix Filtering:** Real-time filtering via `user:`, `domain:`, `email:`, `title:`, and `note:`.
- **Inline Search Bar & All-Vault Toggle:** Instant searching across all vault items directly in-page.
- **Tiered Domain Grouping:** Visual sections for Exact Domain, Base Domain, and Other Items.
- **Quick TOTP Copy:** In-menu TOTP code copy button with feedback.
- **Viewport Boundary Clamping:** Automatically flips above or below inputs to stay on-screen.

---

## Step-by-Step Architecture

### ***Step 1***: Query Prefix Syntax Filter Engine

#### **Step 1.1**: Prefix Syntax Parsing (user:, domain:, email:, title:, note:)
`filterCiphersByQuery(ciphers, rawQuery)`: Parses search syntax prefixes to filter items by specific fields or full-text search.

---

### ***Step 2***: Floating Dropdown Lifecycle & Viewport Clamping

#### **Step 2.1**: Dropdown Container Construction & Boundary Clamping
`showFieldDropdown(targetInput)`:
- Positions menu relative to target input.
- Clamps coordinates within viewport boundaries to prevent cutoff.

---

### ***Step 3***: Inline Search Header & All-Vault Toggle

#### **Step 3.1**: Inline Search Input & Mode Switching
- Handles real-time search input events.
- **Search All Vault Items Toggle:** Switches between tab-matching credentials and full vault inventory.

---

### ***Step 4***: Tiered Match Presentation Groups

#### **Step 4.1**: Exact Domain, Base Domain & Other Items Sections
`renderCiphers()`: Partitions displayed items into:
1. `Exact Domain Matches (domain.com)`
2. `Base Domain Matches (base.com)`
3. `Other Vault Items`

---

### ***Step 5***: One-Click Autofill, Quick TOTP Copy & Action Routing

#### **Step 5.1**: Item Click Autofill & Quick TOTP Copy
- `handleItemFill(cipher)`: Injects credentials via `fillCredential`.
- Dedicated TOTP copy button copies 6-digit code to clipboard.
- Renders "Unlock Vault" action if vault is locked.
