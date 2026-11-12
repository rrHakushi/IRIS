# Vault Listing, Tiered Matching & Item Inspector

> **Source File:** `plugins/akaromi-firefox/popup/js/vault.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `AkaromiVault`  

---

## Overview
`popup/js/vault.js` manages the master vault item list, syntax query filtering, tiered domain match rendering, sensitive notes masking, and cipher details.

---

## Features
- **Syntax Filter Parsing:** Supports `user:`, `domain:`, `email:`, `title:`, and `note:`.
- **Tiered Domain Presentation:** Exact Domain Matches, Base Domain Matches, and All Items.
- **Sensitive Notes Masking:** Blurred by default; unblurred on active focus/click.
- **Live TOTP Countdown:** Progress wheel and next-token (+30s) preview.

---

## Step-by-Step Architecture

### ***Step 1***: Vault Search Query Parsing

#### **Step 1.1**: Query Syntax Tokenizer (user:, domain:, email:, title:, note:)
`filterVaultCiphers(ciphers, query)`: Parses keyword prefixes or performs fuzzy search across items.

---

### ***Step 2***: Tiered Match Section Rendering

#### **Step 2.1**: Exact Domain, Base Domain & All Items Rendering
`renderCiphersList()`: Separates items into prioritized sections:
1. Exact Domain Matches
2. Base Domain Matches
3. All Vault Items

---

### ***Step 3***: Cipher Detail Pane Rendering & Security Actions

#### **Step 3.1**: Detail View Population & Masked Field Rendering
`showCipherDetail(cipher)`: Populates detail view with username, masked password, TOTP, URIs, and timestamps.

---

### ***Step 4***: Sensitive Notes Privacy Masking

#### **Step 4.1**: Notes Inactive Blur & Focus/Click Unmasking
- Sensitive notes are blurred by default (`filter: blur(4px)`).
- Automatically unblurs when clicked or focused; re-blurs on blur.
- Includes manual eye toggle button for permanent reveal.

---

### ***Step 5***: Live In-Popup TOTP Countdown

#### **Step 5.1**: 1-Second Interval Countdown & Live Progress Wheel
`startLiveTotpCountdown(secret)`: Updates circular progress indicator, 6-digit token, and next-token preview every second.
