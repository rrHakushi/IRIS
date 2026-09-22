# IRIS Pass — Firefox WebExtension

Official zero-knowledge encrypted password manager, passkey authenticator, and autofill extension for the **IRIS** ecosystem.

---

## Features

- **Zero-Knowledge Encryption**: End-to-end client-side encryption using WebCrypto AES-256-GCM and PBKDF2/scrypt key wrapping. Master passwords and secret keys never leave memory.
- **Form Autofill Engine**: Injects floating badges on login and password fields with one-click dropdown suggestions and active input detection.
- **Passkey (WebAuthn / FIDO2) Support**: In-page mediation intercepts `navigator.credentials.create` and `navigator.credentials.get` to store passkeys in the vault and authenticate with existing passkeys.
- **Bitwarden Multi-Match Detection**: Matches active tabs using all 6 Bitwarden URI match strategies (`BaseDomain`, `Host`, `StartsWith`, `Exact`, `RegularExpression`, `Never`).
- **TOTP 2FA Assistant**: Live countdown widget with auto-copy and auto-refresh for 2FA one-time verification codes.
- **PIN Unlock**: Zero-knowledge PIN fast unlock with scrypt key wrapping.
- **Cryptographic Generator**:
  - Passwords up to **256 characters** with customizable charsets.
  - Diceware passphrases up to **32 words**.

---

## How to Install & Run in Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **"Load Temporary Add-on..."**.
3. Select `plugins/iris-pass-firefox/manifest.json`.
4. The **IRIS Pass** icon will appear in your Firefox toolbar.

---

## Packaging for AMO

To build the submission `.zip` archive:
```bash
npm run build
```
The output package will be generated at `dist/iris_pass-1.5.2.zip`.
