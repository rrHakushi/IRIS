# Background Vault Cryptography & Sync Pipeline

> **Source File:** `plugins/akaromi-firefox/background/vault.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`background/vault.js` handles encrypted local cache decryption, server vault synchronization, and in-memory credential lookups.

---

## Features
- **Offline Decryption:** Decrypts cached encrypted ciphers with zero network latency.
- **Parallel Field Decryption:** Decrypts cipher titles and JSON data simultaneously.
- **Dynamic Badge Sync:** Updates extension toolbar count upon decryption.

---

## Step-by-Step Architecture

### ***Step 1***: Local Encrypted Cache Decryption

#### **Step 1.1**: Fast Offline Cache Decryption Pipeline
`decryptCachedVault(vaultKey)`:
1. Reads `cachedEncryptedCiphers` from local storage.
2. Decrypts title with `IrisCrypto.decryptVaultData`.
3. Decrypts object payload with `IrisCrypto.decryptVaultObject`.
4. Populates `inMemoryCiphers` and updates action badge.

---

### ***Step 2***: Remote Server Synchronization

#### **Step 2.1**: Hourly & Force Sync Orchestrator
`syncVault(options)`:
- Checks `lastSyncTimestamp`.
- Fetches remote encrypted ciphers from API, updates local cache, decrypts into memory, and updates timestamp.

---

### ***Step 3***: In-Memory Cipher Lookups

#### **Step 3.1**: Decrypted Cipher Lookup by ID
`getDecryptedCipherById(id)`: Queries in-memory cipher list instantly by unique identifier.
