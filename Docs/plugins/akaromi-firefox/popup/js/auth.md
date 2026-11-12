# Authentication, Master Unlock & PIN Verification

> **Source File:** `plugins/akaromi-firefox/popup/js/auth.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `AkaromiAuth`  

---

## Overview
`popup/js/auth.js` governs account login, MFA verification, master password unlocking, and PIN unlock with brute-force defense.

---

## Features
- **Account & API Key Login:** Standard credentials or API Key authentication with custom server URLs.
- **Multi-Factor Verification:** 6-box OTP entry for TOTP, email codes, and backup codes.
- **Master Password Unlock:** Decrypts master private key via Scrypt.
- **PIN Unlock & Rate Limiting:** Quick access with 5-attempt progressive lockout defense.

---

## Step-by-Step Architecture

### ***Step 1***: Server Authentication & API Key Login

#### **Step 1.1**: Identifier/Password and API Key Submission
- Submits login form to background worker.
- Supports switching between Account Login and API Key tabs.
- Configures custom backend server URL.

---

### ***Step 2***: Multi-Factor Authentication Verification

#### **Step 2.1**: 6-Box OTP Verification & Backup Code Fallback
Handles 6-digit OTP box navigation, email resend triggers, and recovery codes.

---

### ***Step 3***: Master Password Vault Unlock Pipeline

#### **Step 3.1**: Scrypt Key Derivation & Vault Decryption
Submits master password to derive key, decrypt vault in RAM, and switch UI to unlocked view.

---

### ***Step 4***: PIN Unlock & Brute-Force Lockout Defense

#### **Step 4.1**: Quick PIN Entry Submission & 5-Attempt Lockout Defense
- Fast PIN entry submission.
- Enforces lockout after 5 consecutive failed attempts, requiring master password entry.
