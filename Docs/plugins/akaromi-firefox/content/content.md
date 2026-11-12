# Content Script Coordinator & UI Portals

> **Source File:** `plugins/akaromi-firefox/content/content.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`content/content.js` coordinates DOM portals, mobile Android in-page unlock overlays, screen QR code snipping, and global event listeners.

---

## Features
- **Persistent DOM Portal:** Maintains isolated `#akaromi-portal` on `document.body`.
- **Inert Attribute Neutralizer:** Strips `inert` and `aria-hidden` if host page modals attempt to disable extension UI.
- **Android In-Page Unlock Modal:** In-DOM unlock dialog for mobile Firefox where popup windows cannot render.
- **Screen Area Snipping Canvas:** Interactive drag-to-select QR code scanner.

---

## Step-by-Step Architecture

### ***Step 1***: Portal Container & Focus Isolation

#### **Step 1.1**: Persistent DOM Portal Setup & Inert Neutralizer
`getOrCreatePortal()`:
- Attaches `#akaromi-portal` to `document.body`.
- Uses `MutationObserver` to strip `inert` and `aria-hidden` attributes applied by host page modals.

---

### ***Step 2***: Android In-Page Unlock Modal Dialog Overlay

#### **Step 2.1**: In-Page Unlock Dialog Construction & Submission
`showInPageUnlockModal(onUnlocked)`:
- Renders modal dialog for Master Password and PIN unlock on Firefox for Android.
- Unlocks background vault and invokes `onUnlocked` callback to resume autofill.

---

### ***Step 3***: Screen Area Snipping Canvas & QR Code Detection

#### **Step 3.1**: Interactive Screen Selection Box & QR Decoding
`startScreenQrScan(onDetected)`:
- Injects semi-transparent canvas overlay for selecting on-screen QR codes.
- Passes cropped canvas image to `IrisQrDecoder.scanImage` to extract TOTP secrets.

---

### ***Step 4***: Global Input Interception & Secure Clipboard Sync

#### **Step 4.1**: Message Listener & Clipboard Sanitization
- Page-wide `focusin` listener to attach badges to dynamic inputs.
- Handles `CLEAR_CLIPBOARD_IF_MATCHES` messages to sanitize clipboard.
