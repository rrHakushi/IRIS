# Akaromi for Firefox

Official zero-knowledge encrypted password manager, passkey authenticator, and autofill extension for the **IRIS** ecosystem.

---

## Features

- **Proton Pass Master-Detail UI**: Sleek, high-productivity two-column layout on desktop with responsive single-column mobile drilldown.
- **Zero-Knowledge Encryption**: End-to-end client-side encryption using WebCrypto AES-256-GCM and scrypt key wrapping. Your account password and derived vault keys never leave your device unencrypted.
- **Form Autofill Engine**: Floating in-field badges on credential fields with instant discoverability, active input detection, and one-click autofill.
- **Passkey (WebAuthn / FIDO2) Support**: In-page mediation intercepts `navigator.credentials.create` and `navigator.credentials.get` to store passkeys in the vault and authenticate with existing passkeys.
- **Multi-Item Types**: Dedicated support for Logins, Notes, Credit Cards, SSH Keys, Identities, and Custom fields.
- **TOTP 2FA Assistant**: Live countdown widget with auto-copy and auto-refresh for 2FA one-time verification codes.
- **Fast PIN Unlock**: Numeric PIN unlock with scrypt key wrapping.
- **Cryptographic Generator**:
  - Passwords up to **64 characters** with customizable charsets.
  - Diceware passphrases up to **10 words**.

---

## How to Install & Run in Firefox

1. Open Firefox and navigate to:
   ```text
   about:debugging#/runtime/this-firefox
   ```
2. Click **"Load Temporary Add-on..."**.
3. Select `plugins/akaromi-firefox/manifest.json`.
4. The **Akaromi for Firefox** icon will appear in your Firefox toolbar.

---

## Packaging for AMO

To build the submission `.zip` archive:
```bash
npm run build
```
The output package will be generated at `releases/akaromi/akaromi_for_firefox-2.0.0.zip`.
