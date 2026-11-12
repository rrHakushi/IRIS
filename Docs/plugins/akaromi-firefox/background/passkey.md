# Background WebAuthn Passkey Cryptography

> **Source File:** `plugins/akaromi-firefox/background/passkey.js`  
> **Document Type:** Diátaxis Technical Reference  

---

## Overview
`background/passkey.js` provides binary conversion, CBOR attestation generation, and ECDSA signature formatting for WebAuthn passkey mediation.

---

## Features
- **Base64URL Conversions:** Standards-compliant URL-safe Base64 encoding/decoding.
- **CBOR Attestation:** RFC 8949 CBOR encoding for WebAuthn creation responses.
- **Raw to DER Conversion:** Converts IEEE P1363 (r, s) signatures to ASN.1 DER format.

---

## Step-by-Step Architecture

### ***Step 1***: Binary Buffer Encoding & Decoding Utilities

#### **Step 1.1**: ArrayBuffer to Base64URL Conversion & Decoding
- `bufferToBase64Url(buf)`: Encodes byte arrays to Base64URL format without padding.
- `base64UrlToBuffer(str)`: Decodes Base64URL string back to `ArrayBuffer`.

---

### ***Step 2***: CBOR Attestation Object Structuring

#### **Step 2.1**: RFC 8949 CBOR Map Generation for WebAuthn
`encodeCborAttestation(authData)`:
Constructs valid CBOR structure containing `fmt: "none"`, `attStmt: {}`, and `authData` bytes.

---

### ***Step 3***: ECDSA Signature Formatting

#### **Step 3.1**: IEEE P1363 Raw to ASN.1 DER Signature Conversion
`rawToDerSignature(rawSig)`: Converts raw 64-byte P-256 signatures into ASN.1 DER sequences for WebAuthn assertion verification.
