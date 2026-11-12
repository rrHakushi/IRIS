# IRIS Backend HTTP API Client

> **Source File:** `plugins/akaromi-firefox/lib/api.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `IrisApi`  

---

## Overview
`lib/api.js` manages HTTP communication with the IRIS backend server, handling authentication headers, pre-login salt queries, and encrypted vault synchronization.

---

## Features
- **Dynamic Server URL:** Default `http://localhost:4000`, configurable via extension settings.
- **Dual Authentication:** Supports both Session Bearer Tokens and API Keys (`x-api-key`).
- **Pre-Login Salt Retrieval:** Fetches salt and KDF parameters prior to password hashing.
- **Encrypted Cipher CRUD:** Full remote sync, creation, editing, and soft-deletion endpoints.

---

## Step-by-Step Architecture

### ***Step 1***: Endpoint Configuration & Token Resolution

#### **Step 1.1**: Server URL Resolution & Storage Persistence
- `IrisApi.getServerUrl()` / `setServerUrl(url)`: Sanitizes trailing slashes and persists URL.
- `IrisApi.getToken()`: Returns active `authToken` and `apiKey`.
- `request(path, options)`: Dispatches fetch requests with appropriate headers and `credentials: "include"`.

---

### ***Step 2***: Authentication & Session Verification

#### **Step 2.1**: Login Submission & Session Token Persistence
- `IrisApi.getPreLoginSalt(identifier)`: `GET /api/pass/auth/prelogin`.
- `IrisApi.login(identifier, password, otp)`: `POST /api/pass/auth/login`. Captures and stores `authToken`.
- `IrisApi.checkAuth()`: `GET /api/pass/auth/check`. Validates session and retrieves user profile customizations.

---

### ***Step 3***: Vault Synchronization & Cipher CRUD Pipeline

#### **Step 3.1**: Full Encrypted Vault Pull & Cipher CRUD Lifecycle
- `IrisApi.syncVaultData()`: `GET /api/pass/ciphers/sync`. Returns all encrypted ciphers.
- `IrisApi.createCipher(data)`: `POST /api/pass/ciphers`.
- `IrisApi.updateCipher(id, data)`: `PUT /api/pass/ciphers/:id`.
- `IrisApi.deleteCipher(id)`: `DELETE /api/pass/ciphers/:id`.
