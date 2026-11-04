# Akaromi for Firefox — Manifest V3 Specification

> **Source File:** `plugins/akaromi-firefox/manifest.json`  
> **Document Type:** Diátaxis Technical Reference  
> **Target Platform:** Mozilla Firefox Desktop (>= 142.0) & Firefox for Android (>= 142.0)  

---

## Overview
`manifest.json` configures the WebExtensions runtime parameters for Akaromi. It establishes cross-platform Gecko and Android compatibility, declares granular browser privileges, specifies background execution order, and registers content scripts for Main-World WebAuthn interception and isolated form autofill.

---

## Features
- **Strict Gecko & Android Support:** Enforces minimum version 142.0 for WebExtensions Manifest V3 stability.
- **Zero Data Collection Policy:** Declares required data collection as `none`.
- **Declarative Permissions:** Minimal necessary privilege set (`activeTab`, `tabs`, `storage`, `privacy`, `scripting`, `clipboardWrite`, `alarms`).
- **Incognito Spanning:** Operates across normal and private browsing contexts sharing a single background session.
- **Ordered Background Pipeline:** Sequential background script declaration for synchronous dependency resolution.
- **Dual-World Content Scripts:** Main-World injection for `navigator.credentials` monkeypatching and Isolated-World scripts for DOM autofill.

---

## Step-by-Step Architecture

### ***Step 1***: Platform Manifest Specification & Target Environments

#### **Step 1.1**: Gecko Desktop & Android Minimum Versions
Defines the extension identifier `info@runerra.org` and target Gecko browser engines:
```json
"browser_specific_settings": {
  "gecko": {
    "id": "info@runerra.org",
    "strict_min_version": "142.0"
  },
  "gecko_android": {
    "strict_min_version": "142.0"
  }
}
```
Ensures the extension runs on both desktop Firefox and mobile Firefox for Android.

#### **Step 1.2**: Data Collection Permissions & Privacy Disclosures
Declares `data_collection_permissions.required = ["none"]` to explicitly affirm zero telemetry or user data collection.

---

### ***Step 2***: Extension Capabilities & Security Permissions

#### **Step 2.1**: Declarative WebExtensions Permissions
- `activeTab`: Access to focused tab for URL resolution and coordinate tracking.
- `tabs`: Tab event monitoring and Android fallback unlock tab creation.
- `storage`: Access to `browser.storage.local` and `browser.storage.session`.
- `privacy`: Programmatic control over native browser password saving.
- `scripting`: Dynamic re-injection into existing tabs upon reload.
- `clipboardWrite`: Sensitive credential copying.
- `alarms`: Periodic background auto-lock and hourly synchronization timers.

#### **Step 2.2**: Host Permissions & Incognito Spanning Mode
- `host_permissions`: `["<all_urls>"]` to permit form heuristics across all web domains.
- `incognito`: `"spanning"`, ensuring unified session security across private windows.

---

### ***Step 3***: Script Registration & Isolated Environments

#### **Step 3.1**: Background Scripts Pipeline Configuration
Declared sequentially under `background.scripts` to guarantee linear global namespace initialization:
1. `lib/noble.js`
2. `lib/crypto.js`
3. `lib/matching.js`
4. `lib/totp.js`
5. `lib/qr-decoder.js`
6. `lib/storage.js`
7. `lib/api.js`
8. `background/state.js`
9. `background/vault.js`
10. `background/autofill.js`
11. `background/passkey.js`
12. `background/background.js`

#### **Step 3.2**: Main-World & Isolated Content Script Registration
- **Main World:** `content/passkey-injected.js` executed at `document_start` in `world: "MAIN"`.
- **Isolated World:** `lib/icons.js`, `lib/totp.js`, `content/detection.js`, `content/badge.js`, `content/fill.js`, `content/menu.js`, `content/content.js` executed at `document_idle`.

#### **Step 3.3**: Web Accessible Resources Exposure
Exposes PNG icons (16px, 48px, 128px, 512px) across `<all_urls>` for rendering within host page DOM portals.
