# Extension Popup Reactive State & Utilities

> **Source File:** `plugins/akaromi-firefox/popup/js/state.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `AkaromiState`, `AkaromiUtils`  

---

## Overview
`popup/js/state.js` manages the centralized reactive state of the popup window and exposes DOM sanitization utilities.

---

## Features
- **Safe Template Parsing:** Uses `DOMParser` to prevent XSS.
- **HTML Entity Escaping:** Escapes special HTML characters.
- **Ephemeral Toasts:** Non-blocking temporary toast notifications.
- **Centralized State:** Stores active ciphers, tab info, search queries, and selected IDs.

---

## Step-by-Step Architecture

### ***Step 1***: DOM Template Rendering & HTML Sanitization

#### **Step 1.1**: Safe DOMParser Child Replacement & Entity Escaping
- `safeSetTemplate(element, htmlString)`: Parses markup securely via `DOMParser`.
- `escapeHtml(str)`: Escapes HTML entities.

---

### ***Step 2***: Ephemeral Popup Toast Notifications

#### **Step 2.1**: Toast Visibility & Auto-Dismiss Timer
`showToast(message, duration=2500)`: Displays floating feedback notification and auto-hides.

---

### ***Step 3***: Reactive Centralized Popup State Store

#### **Step 3.1**: AppState Object Properties & View Tracking
- `currentUser`, `currentTab`, `allCiphers`, `matchingCiphers`, `selectedCipherId`, `currentSearchQuery`.
