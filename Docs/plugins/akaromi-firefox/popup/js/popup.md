# Popup Lifecycle & View Routing Coordinator

> **Source File:** `plugins/akaromi-firefox/popup/js/popup.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`popup/js/popup.js` is the entry coordinator of the extension popup, initializing state, binding search inputs, and routing views.

---

## Features
- **Search Bar Synchronization:** Real-time query binding and clear button handling.
- **Syntax Chip Injections:** Appends prefix syntax tokens to search queries on click.
- **Mobile Responsive Navigation:** Toggles between master list and detail views on small screens.
- **Master Initialization:** Resolves active tab, queries background status, and routes views.

---

## Step-by-Step Architecture

### ***Step 1***: Search Bar & Filter Chip Bindings

#### **Step 1.1**: Real-Time Search Query Synchronization & Syntax Chip Injections
- Listens to search input events and re-renders vault list.
- Clicking filter chips (`user:`, `domain:`, `email:`, `title:`, `note:`) appends prefix to query.

---

### ***Step 2***: Mobile Responsive Navigation

#### **Step 2.1**: Master List & Detail View Toggle
`btnMobileBack`: On mobile viewports, navigates back from cipher detail view to master list.

---

### ***Step 3***: Master Initialization Pipeline

#### **Step 3.1**: Active Tab URL Resolution, Background Status Query & View Routing
`initPopup()`:
1. Queries active tab URL.
2. Calls `GET_STATUS` on background worker.
3. Routes to **Login View**, **Locked View** (Master Password or PIN), or **Unlocked View**.
4. Triggers background sync check and renders matching credentials.
