# Resilient Multi-Tier Storage Abstraction Engine

> **Source File:** `plugins/akaromi-firefox/lib/storage.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `IrisStorage`  

---

## Overview
`lib/storage.js` abstracts extension persistence into `browser.storage.local`, providing origin isolation, automatic migration from legacy IndexedDB, and sub-millisecond in-memory caching.

---

## Features
- **Origin Isolation:** Stored under the extension's privileged origin; host web pages have zero access.
- **Private Browsing Support:** Full compatibility with standard and incognito windows without `SecurityError`.
- **Automatic Migration:** Transparent one-time migration from legacy IndexedDB to `browser.storage.local`.
- **L1 In-Memory Cache:** Synchronous `Map` cache for instant configuration lookups.

---

## Step-by-Step Architecture

### ***Step 1***: Storage Migration & Compatibility

#### **Step 1.1**: One-Time IndexedDB Legacy Migration
`checkAndMigrateLegacyIndexedDB()`:
- Opens legacy `iris_pass_db` IndexedDB if present.
- Migrates all stored records into `browser.storage.local` and closes database.

---

### ***Step 2***: Privileged WebExtensions Local Storage Wrapper

#### **Step 2.1**: Key-Value Retrieval with Default Fallbacks
- `IrisStorage.get(keys)`: Resolves keys from `browser.storage.local` with fallback handling.
- `IrisStorage.set(items)`: Asynchronously stores key-value pairs.
- `IrisStorage.remove(keys)` / `clear()`: Securely deletes specified keys or wipes local storage.

---

### ***Step 3***: In-Memory L1 Cache Layer

#### **Step 3.1**: Fast Synchronous RAM Cache & Invalidation
- `IrisStorage.getRaw(key)`: Instant synchronous retrieval from in-memory `Map` cache.
- Updates cache automatically on `set` and `remove` operations.
