# Changelog

All notable changes to **IRIS Pass** are documented in this file.

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
