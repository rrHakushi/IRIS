# Changelog

All notable changes to **IRIS Pass** are documented in this file.

## [1.6.0] - 2026-10-08

### Added
- **Firefox for Android Support**: Added `gecko_android` manifest configuration with min-version 121.0, scoped mobile responsive styles, and Android tab query fallbacks.
- **Header Item Creation**: Added quick-add `+` button in the main header for rapid credential entry.
- **Card Action Menu**: Replaced horizontal action bar with a compact 3-dot dropdown menu (`⋮`) for copying username, password, TOTP, and editing items. Direct card click performs credential autofill.
- **Vault Search Persistence**: Vault search input now remembers the last filter query across popup closures.
- **Draft State Persistence**: Unsaved new item drafts automatically persist to storage during creation and resume seamlessly if the popup is closed.
- **Lock Badge Indicator**: Added dynamic `🔒` badge indicator on the extension action icon when vault is locked.

### Changed
- **Design Alignment**: Upgraded theme palette to Mauve dark base (`#16141a`) with Rose accents (`#f43f5e`), custom scrollbar suppression, and streamlined edge-to-edge list presentation.
- **Simplified Settings & Headers**: Relocated sync button to Settings tab and purged redundant helper descriptions.
- **Removed Lock Avatar**: Cleaned up the locked view panel to remove the redundant center lock avatar.

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
