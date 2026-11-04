# Settings, Auto-Lock & Drawer Navigation

> **Source File:** `plugins/akaromi-firefox/popup/js/settings.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `AkaromiSettings`  

---

## Overview
`popup/js/settings.js` controls the navigation drawer, security configuration, auto-lock timeouts, clipboard timers, and PIN setup.

---

## Features
- **Sliding Navigation Drawer:** User avatar, name, server URL, Lock, Sync, and Logout actions.
- **Security Preferences:** Auto-lock timeout, clipboard wipe countdown, and default password manager toggle.
- **PIN Setup Workflow:** Setup, change, and remove PIN unlock envelopes.

---

## Step-by-Step Architecture

### ***Step 1***: Navigation Drawer & User Profile

#### **Step 1.1**: Sliding Drawer Animation, Lock, Sync & Logout Triggers
- `openDrawer()` / `closeDrawer()`: Animates navigation drawer.
- Triggers manual vault lock, immediate sync, or account logout.

---

### ***Step 2***: Security Preferences Configuration

#### **Step 2.1**: Auto-Lock Timeout, Clipboard Countdown & Default PM Handover
- Configures `autoLockMinutes` (Immediately, 1m, 5m, 15m, 1h, Never).
- Configures `clipboardClearSeconds` (10s, 30s, 60s, 120s, Never).
- Toggles native Firefox default password manager handover.

---

### ***Step 3***: Cryptographic PIN Setup & Deconfiguration

#### **Step 3.1**: PIN Setup Modal, Change & Removal Workflows
- Validates minimum PIN length of 4 characters.
- Encrypts vault key into local storage PIN envelope or removes PIN credentials.
