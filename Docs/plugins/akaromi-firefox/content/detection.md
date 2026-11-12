# Heuristic Credential Field Detection

> **Source File:** `plugins/akaromi-firefox/content/detection.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `AkaromiDetection`  

---

## Overview
`content/detection.js` scans host web page DOM trees using Bitwarden-grade heuristics to classify login fields while filtering out search boxes and unrelated inputs.

---

## Features
- **Search Box Filtering:** Strictly avoids attaching autofill badges to search inputs.
- **Promo & OTP Exclusion:** Ignores promo code, coupon, and CAPTCHA fields.
- **Credential Identification:** Identifies username, email, password, and new password fields.
- **Multi-Field Association:** Associates usernames with their matching password fields.

---

## Step-by-Step Architecture

### ***Step 1***: Search & Irrelevant Field Exclusion Heuristics

#### **Step 1.1**: Search Box & Promo Code Filtering
`isSearchInput(el)`:
- Checks `type="search"`, `role="search"`, and identifiers matching `/(search|query|find|filter|lookup|keyword)/i`.
- Excludes promo codes and security codes.

---

### ***Step 2***: Credential Field Identification Heuristics

#### **Step 2.1**: Username, Email & Password Field Detection
`isCredentialInput(el)`:
- Excludes unsupported types (`hidden`, `checkbox`, `radio`, `file`, etc.).
- Identifies password inputs and text/email inputs matching username patterns.

---

### ***Step 3***: Multi-Field Form Association

#### **Step 3.1**: Pairing Username with Corresponding Password Field
`findAssociatedPasswordInput(userInput)`: Searches parent form or nearby DOM siblings to pair username and password fields.
