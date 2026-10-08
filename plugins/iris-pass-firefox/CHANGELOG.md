# Changelog

All notable changes to **IRIS Pass** are documented in this file.

## [1.6.0] - 2026-10-08

### Added
- **Firefox for Android Support**: Added `gecko_android` manifest configuration, scoped mobile viewport styles, and Android tab query fallbacks.
- **Header Item Creation**: Added quick-add `+` button in the main header for rapid credential entry.
- **Card Action Menu**: Replaced horizontal action bar with a compact 3-dot dropdown menu (`⋮`) for copying username, password, TOTP, and editing items. Direct card click performs credential autofill.
- **Vault Search Persistence**: Vault search input now remembers the last filter query across popup closures.
- **Draft State Persistence**: Unsaved new item drafts automatically persist to storage during creation and resume seamlessly if the popup is closed.

### Changed
- **New Theme Alignment**: Adopted the core IRIS UI system theme from `@workspace/ui` (`oklch` dark palette tokens and global monospace typography).
- **AMO Validation Compliance**: Raised `strict_min_version` to `142.0` in `manifest.json` and eliminated unsafe `innerHTML` assignments via DOMParser for clean validation (0 errors, 0 warnings).
- **Simplified Settings & Headers**: Relocated sync button to Settings tab and purged redundant helper descriptions.
- **Clean Lock Screen & Icon**: Removed the lock avatar from the locked screen and cleared the toolbar icon badge when locked.

---

## [1.5.1] - 2026-09-21

### Added
- **New Mascot & Extension Branding Icon**: Updated extension icons with high-resolution character badge assets.
- **Top-Level Portal Container (`#iris-pass-portal`)**: In-page dialogs, autofill badges, and dropdowns are now mounted directly to `document.documentElement`, isolating them from `<body>` modal focus traps and accessibility sweeps.

### Fixed
- **Passkey Login Detection**: Corrected property key mapping (`credentials` & `passkeys`) between background worker and content script, enabling saved passkeys to be properly discovered and selected during login.
- **Modal Event Isolation**: Added capture-phase interception for pointer and focus events on IRIS Pass elements, preventing host-page modal frameworks (such as React Aria and Radix UI) from closing open dialogs when interacting with the extension.
- **Inert Attribute Protection**: Added an active attribute observer to prevent external host-page accessibility scripts from marking extension overlays as `inert` or `aria-hidden`.
- **Autofill Dropdown Anchor Alignment**: Positioned the credential autofill dropdown directly beneath the input field badge on the right edge instead of the input's left boundary.
- **Credential ID Resolution**: Fixed account select value resolution during passkey assertion signing.

---

## [1.5.0] - 2026-09-20

### Added
- Initial release of WebAuthn Passkey creation and authentication in-page mediation.
- In-field Bitwarden-style autofill badges and search dropdown.
- Zero-knowledge vault key derivation and AES-256-GCM encryption.
- Multi-URI matching engine (BaseDomain, Host, StartsWith, Exact, Regex).
- Floating TOTP countdown widget with clipboard synchronization.
