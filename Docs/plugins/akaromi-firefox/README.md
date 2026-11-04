# Akaromi for Firefox — Technical Documentation Index

> **Document Type:** Diátaxis Documentation Index & Navigation Map  
> **Target:** Mozilla Firefox Extension (`plugins/akaromi-firefox`)  
> **Version:** 2.1.0  

---

## Architecture Overview

Akaromi for Firefox is fully documented across individual technical specification files that map 1:1 to the source codebase. Each document contains its own self-contained step counter starting from **Step 1**, matching the corresponding step comments embedded directly within the source code.

```
Docs/plugins/akaromi-firefox/
├── README.md                      # This master index
├── manifest.md                    # Manifest V3 schema & permissions
├── lib/
│   ├── noble.md                   # Low-level cryptographic primitives
│   ├── crypto.md                  # Vault cryptography & key management
│   ├── matching.md                # Bitwarden-compatible URI matcher
│   ├── totp.md                    # RFC 6238 TOTP engine
│   ├── qr-decoder.md              # Standalone CV QR code decoder
│   ├── storage.md                 # Multi-tier storage engine
│   ├── api.md                     # IRIS backend HTTP client
│   └── icons.md                   # Tabler SVG icon repository
├── background/
│   ├── state.md                   # Session state & auto-lock timers
│   ├── vault.md                   # Vault sync & offline decryption
│   ├── autofill.md                # Autofill matching & toolbar badging
│   ├── passkey.md                 # WebAuthn passkey cryptography
│   └── background.md              # Event bus & lifecycle coordinator
├── content/
│   ├── detection.md               # Credential form field heuristics
│   ├── badge.md                   # Floating in-input badge widget
│   ├── fill.md                    # Synthetic form autofill engine
│   ├── menu.md                    # In-page autofill menu & search
│   ├── content.md                 # Content coordinator & Android modal
│   └── passkey-injected.md        # Main-world WebAuthn interceptor
└── popup/
    ├── popup.md                   # Dual-pane master shell layout
    └── js/
        ├── state.md               # Popup reactive state & utilities
        ├── customization.md       # User profile styling engine
        ├── vault.md               # Vault listing & detail inspector
        ├── editor.md              # Cipher editor modal suite
        ├── generator.md           # Password & passphrase generator
        ├── auth.md                # Login, MFA & unlock controllers
        ├── settings.md            # Settings drawer & PIN setup
        └── popup.md               # Popup coordinator & view router
```

---

## 1:1 Document & Codebase Directory

| Source File | Documentation | Step Counter | Key Capabilities |
| :--- | :--- | :--- | :--- |
| [`manifest.json`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/manifest.json) | [manifest.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/manifest.md) | Steps 1 - 3 | MV3 declarative permissions, Gecko/Android minimum versions, script pipelines. |
| [`lib/noble.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/lib/noble.js) | [lib/noble.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/lib/noble.md) | Steps 1 - 4 | Binary conversions, SHA-256/512, ChaCha20-Poly1305, Curve25519/Ed25519. |
| [`lib/crypto.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/lib/crypto.js) | [lib/crypto.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/lib/crypto.md) | Steps 1 - 6 | Scrypt + HKDF master keys, AES-256-GCM cipher, PIN envelope, password/Diceware generators. |
| [`lib/matching.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/lib/matching.js) | [lib/matching.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/lib/matching.md) | Steps 1 - 3 | Bitwarden URI matching, strict host detection, public suffix resolution. |
| [`lib/totp.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/lib/totp.js) | [lib/totp.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/lib/totp.md) | Steps 1 - 4 | Synchronous RFC 3174 SHA-1 HMAC, Base32 decoding, 30s countdown windows. |
| [`lib/qr-decoder.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/lib/qr-decoder.js) | [lib/qr-decoder.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/lib/qr-decoder.md) | Steps 1 - 5 | Bradley-Roth adaptive binarization, 1:1:3:1:1 finder scanning, +3.5 module offset, Reed-Solomon GF(256). |
| [`lib/storage.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/lib/storage.js) | [lib/storage.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/lib/storage.md) | Steps 1 - 3 | Privileged storage wrapper, IndexedDB migration, L1 memory cache. |
| [`lib/api.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/lib/api.js) | [lib/api.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/lib/api.md) | Steps 1 - 3 | Backend API client, pre-login salt, Bearer/API-key auth, encrypted sync. |
| [`lib/icons.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/lib/icons.js) | [lib/icons.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/lib/icons.md) | Steps 1 - 2 | Tabler SVG vector path repository & DOM icon builders. |
| [`background/state.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/background/state.js) | [background/state.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/background/state.md) | Steps 1 - 3 | Volatile RAM store, session persistence, auto-lock timers & alarms. |
| [`background/vault.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/background/vault.js) | [background/vault.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/background/vault.md) | Steps 1 - 3 | Fast offline cache decryption, remote server sync, in-memory cipher queries. |
| [`background/autofill.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/background/autofill.js) | [background/autofill.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/background/autofill.md) | Steps 1 - 3 | Active tab matching, strict host enforcement, tiered ranking, badge counters. |
| [`background/passkey.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/background/passkey.js) | [background/passkey.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/background/passkey.md) | Steps 1 - 3 | Base64URL conversions, CBOR attestation maps, ECDSA raw-to-DER signatures. |
| [`background/background.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/background/background.js) | [background/background.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/background/background.md) | Steps 1 - 5 | Runtime message routing, clipboard auto-wipe, Android in-page / tab unlock fallbacks. |
| [`content/detection.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/content/detection.js) | [content/detection.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/content/detection.md) | Steps 1 - 3 | Heuristic input classification, search box exclusion, password pairing. |
| [`content/badge.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/content/badge.js) | [content/badge.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/content/badge.md) | Steps 1 - 3 | In-input floating badge widget, eye-button collision avoidance, focus lifecycle. |
| [`content/fill.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/content/fill.js) | [content/fill.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/content/fill.md) | Steps 1 - 3 | Framework-compatible synthetic autofill, native prototype setters, 2FA OTP auto-fill. |
| [`content/menu.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/content/menu.js) | [content/menu.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/content/menu.md) | Steps 1 - 5 | In-page autofill menu, syntax filtering (`user:`, `domain:`), All-Vault toggle, tiered sections. |
| [`content/content.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/content/content.js) | [content/content.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/content/content.md) | Steps 1 - 4 | DOM portal coordinator, inert neutralizer, Android in-page unlock modal, screen QR snipper. |
| [`content/passkey-injected.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/content/passkey-injected.js) | [content/passkey-injected.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/content/passkey-injected.md) | Steps 1 - 3 | Main-world `navigator.credentials` monkeypatching, passkey creation & assertion prompts. |
| [`popup/popup.html`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/popup.html) | [popup/popup.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/popup.md) | Steps 1 - 3 | Dual-pane master-detail shell, search header, filter chips bar, modal containers. |
| [`popup/js/state.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/js/state.js) | [popup/js/state.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/js/state.md) | Steps 1 - 3 | Reactive UI store (`AppState`), DOM template sanitization, ephemeral toasts. |
| [`popup/js/customization.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/js/customization.js) | [popup/js/customization.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/js/customization.md) | Steps 1 - 2 | User styling engine, font presets, avatar URL resolution. |
| [`popup/js/vault.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/js/vault.js) | [popup/js/vault.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/js/vault.md) | Steps 1 - 5 | Tiered matching sections, detail inspector, sensitive notes privacy blur, live TOTP. |
| [`popup/js/editor.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/js/editor.js) | [popup/js/editor.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/js/editor.md) | Steps 1 - 5 | Cipher creation/editing suite, sensitive notes blur, strategy selectors, QR & generator hooks. |
| [`popup/js/generator.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/js/generator.js) | [popup/js/generator.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/js/generator.md) | Steps 1 - 2 | Password & passphrase generator, live Shannon entropy meter, field insertion. |
| [`popup/js/auth.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/js/auth.js) | [popup/js/auth.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/js/auth.md) | Steps 1 - 4 | Account/API key login, 6-box MFA verification, master unlock, PIN unlock with lockout defense. |
| [`popup/js/settings.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/js/settings.js) | [popup/js/settings.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/js/settings.md) | Steps 1 - 3 | Sliding drawer, security preferences, PIN setup and removal workflows. |
| [`popup/js/popup.js`](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/plugins/akaromi-firefox/popup/js/popup.js) | [popup/js/popup.md](file:///c:/Users/yki/OneDrive/Documents/GitHub/IRIS/Docs/plugins/akaromi-firefox/popup/js/popup.md) | Steps 1 - 3 | Popup coordinator, tab resolution, status polling, view routing, mobile switching. |
