# Main-World WebAuthn Passkey Interceptor

> **Source File:** `plugins/akaromi-firefox/content/passkey-injected.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`content/passkey-injected.js` executes in the host webpage's main JavaScript execution context (`world: "MAIN"`) to intercept WebAuthn passkey registration and authentication.

---

## Features
- **Main-World Proxy:** Mediates `navigator.credentials.create` and `navigator.credentials.get`.
- **Platform Authenticator Spoofing:** Reports platform authenticator as available.
- **Registration Approval Dialog:** In-page prompt for creating new passkeys.
- **Authentication Bridge:** Matches credentials and requests background signing.

---

## Step-by-Step Architecture

### ***Step 1***: Main-World Credential API Interception

#### **Step 1.1**: navigator.credentials Monkeypatching & Platform Authenticator Spoofing
- Proxies `navigator.credentials.create` and `get`.
- Overrides `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = () => true`.

---

### ***Step 2***: Passkey Registration Interception

#### **Step 2.1**: In-Page Passkey Registration Approval Dialog
`handleCreate(options)`:
- Intercepts WebAuthn registration requests.
- Shows approval dialog with relying party and user details.
- Dispatches creation request to background worker.

---

### ***Step 3***: Passkey Authentication Interception

#### **Step 3.1**: In-Page Identity Selection & Background Signing
`handleGet(options)`:
- Intercepts WebAuthn login requests.
- Prompts user to choose from matching passkeys and returns signed assertion structure to page.
