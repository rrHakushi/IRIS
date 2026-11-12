# Background Event Bus & Message Routing Coordinator

> **Source File:** `plugins/akaromi-firefox/background/background.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`background/background.js` is the central coordinator of the extension, handling message routing, clipboard sanitization, Android unlock fallbacks, and browser lifecycles.

---

## Features
- **Runtime Message Bus:** Dispatches extension actions across popup, background, and content scripts.
- **Secure Clipboard Sanitization:** Automatically wipes sensitive clipboard content after a countdown.
- **Cross-Platform Unlock Presentation:** Desktop popup windows, Android in-page modals, and tab fallbacks.
- **Firefox Privacy Integration:** Disables native browser password prompts.
- **Script Auto-Reinjection:** Re-injects content scripts upon extension update or reload.

---

## Step-by-Step Architecture

### ***Step 1***: Sensitive Clipboard Auto-Wipe Timer

#### **Step 1.1**: System Clipboard Sanitation Timer & Tab Message Dispatch
`scheduleClipboardWipe(text, seconds=30)`:
- Clears clipboard via background DOM textarea and `navigator.clipboard.writeText`.
- Sends `CLEAR_CLIPBOARD_IF_MATCHES` message to active tab.

---

### ***Step 2***: Runtime Message Dispatcher & Action Router

#### **Step 2.1**: Vault Status, Auth, Unlock & Cipher CRUD Dispatchers
Handles messages:
- `GET_STATUS`: Returns auth state, unlock status, user profile, and settings.
- `LOGIN` / `VERIFY_MFA`: Authenticates session with IRIS API.
- `UNLOCK_VAULT` / `UNLOCK_WITH_PIN`: Decrypts master key into memory.
- `GET_MATCHING_LOGINS`: Returns tiered login candidates for active tab.
- `SAVE_CIPHER` / `DELETE_CIPHER`: Modifies vault items.

---

### ***Step 3***: Cross-Platform Unlock Presentation

#### **Step 3.1**: Desktop Window vs Mobile In-Page Modal & Tab Fallback
`openUnlockDialogWindow(tabId)`:
- Desktop: Opens standalone popup window via `ext.windows.create`.
- Mobile/Android: Dispatches `SHOW_INPAGE_UNLOCK_MODAL` to content script; falls back to `ext.tabs.create({ url: "popup/popup.html" })`.

---

### ***Step 4***: Native Firefox Privacy Service Integration

#### **Step 4.1**: Native Password Saving & Form Autofill Handover
Toggles `browser.privacy.services.passwordSavingEnabled` and `autofillAddressEnabled` to prevent native browser prompt interference.

---

### ***Step 5***: Extension Lifecycle & Tab Script Auto-Reinjection

#### **Step 5.1**: Browser Startup Event Handler & Tab Script Reinjection
- `ext.runtime.onStartup`: Restores active session and initializes badges.
- `ext.runtime.onInstalled`: Iterates over existing HTTP/HTTPS tabs and dynamically injects content scripts via `browser.scripting.executeScript`.
