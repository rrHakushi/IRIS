# Background Session State & Security Lifecycles

> **Source File:** `plugins/akaromi-firefox/background/state.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`background/state.js` maintains volatile in-memory master keys, handles session persistence, and coordinates auto-lock timers.

---

## Features
- **Zero-History In-Memory Cache:** Plaintext keys exist strictly in volatile RAM.
- **Session Persistence:** Ephemeral session storage backup surviving background worker sleep.
- **Configurable Auto-Lock:** Timers (Immediately, 1m, 5m, 15m, 1h, Never).
- **Periodic Sync Alarms:** Hourly vault synchronization checks.

---

## Step-by-Step Architecture

### ***Step 1***: In-Memory Volatile Vault Store

#### **Step 1.1**: Zero-History Vault Key & Decrypted Ciphers State
- `inMemoryVaultKey`: Holds decrypted 256-bit symmetric vault key.
- `inMemoryCiphers`: Holds decrypted active cipher array in RAM.

---

### ***Step 2***: Session Storage Vault Key Persistence

#### **Step 2.1**: Ephemeral Session Storage Backup & Cleansing on Vault Lock
- `saveVaultKeyToSession()`: Saves hex-encoded vault key and `lastActive` timestamp to `browser.storage.session`.
- `clearVaultKeyFromSession()`: Clears session keys upon vault lock.
- `ensureVaultActive()`: Restores vault state from session storage if elapsed time is within `autoLockMinutes`.

---

### ***Step 3***: Auto-Lock Timers & Background Sync Alarms

#### **Step 3.1**: Auto-Lock Timer Reset & Hourly Vault Sync Trigger
- `resetAutoLockTimer()`: Clears existing timer and starts countdown for auto-locking.
- `checkHourlySyncDue()`: Periodically triggers remote synchronization if 60 minutes have elapsed since last sync.
