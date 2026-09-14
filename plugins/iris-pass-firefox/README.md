# IRIS Pass — Firefox WebExtension

Official zero-knowledge encrypted password manager, passkey authenticator, and autofill extension for the **IRIS** ecosystem.

---

## Features

- **Zero-Knowledge Encryption**: End-to-end client-side encryption using WebCrypto AES-256-GCM and HKDF-SHA256 derivation (`iris-pass-vault-v1`). Master passwords and secret keys never leave memory.
- **Form Autofill Engine**: Injects non-intrusive floating badges on login and password fields. Supports one-click dropdown suggestions and keyboard shortcut `Ctrl+Shift+L`.
- **Passkey (WebAuthn / FIDO2) Support**: In-page mediation intercepts `navigator.credentials.create` and `navigator.credentials.get` to store passkeys in the vault and authenticate with existing passkeys.
- **Bitwarden Multi-Match Detection**: Matches active tabs using all 6 Bitwarden URI match strategies (`BaseDomain`, `Host`, `StartsWith`, `Exact`, `RegularExpression`, `Never`).
- **TOTP 2FA Auto-Copy**: Automatically computes RFC 6238 6-digit verification codes and copies them to the clipboard upon autofill.
- **Cryptographic Generator**:
  - Passwords up to **256 characters** with customizable charsets.
  - Diceware passphrases up to **32 words**.
  - Real-time Shannon entropy and strength indicator.

---

## How to Install & Run in Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **"Load Temporary Add-on..."**.
3. Navigate to this directory:
   ```text
   C:\Users\yki\Documents\GitHub\IRIS\plugins\iris-pass-firefox
   ```
4. Select `manifest.json`.
5. The **IRIS Pass** icon will appear in your Firefox toolbar.

---

## Configuration & Usage

1. Click the **IRIS Pass** toolbar icon.
2. Choose your preferred sign-in method:
   - **Account**: Enter your username/email and password. If your account has **Two-Factor Authentication (2FA)** enabled, the extension will prompt you for your 6-digit authenticator code (or backup code).
   - **API Key**: Enter an IRIS API key and your Master Password to directly connect and decrypt your vault.
3. If your IRIS instance is running at a custom address, expand the **Server** configuration (default: `http://localhost:4000`).
4. When visiting websites with saved credentials, the toolbar badge displays the number of matching logins. Press `Ctrl+Shift+L` to autofill immediately!
