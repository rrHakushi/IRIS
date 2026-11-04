# Cipher Creation & Editing Suite

> **Source File:** `plugins/akaromi-firefox/popup/js/editor.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `AkaromiEditor`  

---

## Overview
`popup/js/editor.js` manages cipher creation and editing, URI detection strategy selection, sensitive notes masking, and screen QR scanning.

---

## Features
- **Dynamic Cipher Types:** Login, Secure Note, Credit Card, SSH Key, Identity.
- **Sensitive Notes Masking:** Privacy blur on notes textarea in editor.
- **Multi-URI Strategy Selector:** Independent match strategies per URI.
- **Screen QR Scanner Hook:** Scans 2FA QR codes directly from screen selection.

---

## Step-by-Step Architecture

### ***Step 1***: Cipher Editor Modal Initialization

#### **Step 1.1**: Modal Opening & Dynamic Cipher Type Fields
`openEditorModal(cipherId, type)`: Initializes form fields matching selected cipher type.

---

### ***Step 2***: Sensitive Notes Input Blur Masking

#### **Step 2.1**: Editor Notes Textarea Focus Blur/Unblur Lifecycle
Applies privacy blur to editor notes textarea when unfocused; unblurs on focus.

---

### ***Step 3***: URI Management & Detection Strategy Selection

#### **Step 3.1**: Dynamic URI Row Insertion & Detection Strategy Selector
`populateUris(uris)`: Adds URI rows with strategy selector dropdowns (Base Domain, Host, Starts With, Exact, Regex, Never).

---

### ***Step 4***: TOTP QR Scanning & Generator Integration

#### **Step 4.1**: Screen QR Code Scanning Trigger & Password Generator Direct Injection
- Invokes `startScreenQrScan` to capture 2FA QR codes from screen.
- Injects generated passwords directly into password inputs.

---

### ***Step 5***: Cipher Payload Encryption & Persistence

#### **Step 5.1**: AES-256-GCM Symmetrical Payload Encryption & Background Save Dispatch
`saveCipher()`: Encrypts title and payload via AES-256-GCM and sends save request to background worker.
