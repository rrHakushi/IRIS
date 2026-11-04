# RFC 6238 Time-Based One-Time Password Engine

> **Source File:** `plugins/akaromi-firefox/lib/totp.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `IrisTotp`  

---

## Overview
`lib/totp.js` implements RFC 6238 TOTP computation using an embedded, synchronous pure-JavaScript RFC 3174 SHA-1 and HMAC engine. It operates with zero dependencies in both content scripts and extension popups.

---

## Features
- **RFC 4648 Base32 Decoding:** Ignores whitespace, hyphens, and padding characters.
- **Synchronous Computation:** Immediate calculation without async event delay during autofill.
- **Dynamic Truncation:** Standard RFC 4226 offset extraction.
- **Time Drift Support:** Computes future/next tokens (e.g. +30s) for verification.
- **URI Parser:** Parses `otpauth://totp/...` URIs.

---

## Step-by-Step Architecture

### ***Step 1***: Base32 Encoding & Secret Sanitization

#### **Step 1.1**: RFC 4648 Base32 Decoding
`base32Decode(str)`: Converts 5-bit character indices into 8-bit byte arrays.

#### **Step 1.2**: Raw Secret Normalization & otpauth Extraction
`IrisTotp.extractSecret(secretOrUri)`: Normalizes secret keys by removing prefixes (`secret:`), spaces, and dashes, or extracts secret query parameters from `otpauth://` URIs.

---

### ***Step 2***: Synchronous RFC 3174 SHA-1 & HMAC-SHA1 Engine

#### **Step 2.1**: Synchronous Pure-JS SHA-1 Block Processing
Self-contained 80-round SHA-1 hash implementation operating over 512-bit message blocks.

#### **Step 2.2**: HMAC-SHA1 Key Padding & Inner/Outer Hashing
Executes RFC 2104 inner (`0x36`) and outer (`0x5c`) key XOR steps.

---

### ***Step 3***: TOTP Token Calculation & Countdown

#### **Step 3.1**: Epoch Counter Calculation & Dynamic Truncation
`IrisTotp.generateTotpSync(secretOrUri, timeStepSeconds=30, timeOffsetSeconds=0)`:
1. Calculates time counter:
   $$T = leftlfloor rac{	ext{now}() + 	ext{offset}}{	ext{timeStepSeconds}} ightfloor$$
2. Hashes 8-byte big-endian counter with HMAC-SHA1.
3. Applies dynamic 4-byte offset truncation to extract 31-bit integer.
4. Returns `(binary pmod{10^6})` formatted as a 6-digit zero-padded string.

#### **Step 3.2**: Remaining Seconds in Time Window
`IrisTotp.getRemainingSeconds(timeStepSeconds=30)`: Calculates seconds until window rollover (`30 - (now % 30)`).

---

### ***Step 4***: otpauth:// URI Parser

#### **Step 4.1**: URI Parameter Parsing & Validation
`IrisTotp.parseOtpAuthUri(uri)`: Extracts `secret`, `label`, `issuer`, `digits` (default 6), and `period` (default 30).
