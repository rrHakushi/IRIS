# Low-Level Cryptographic Primitives Engine

> **Source File:** `plugins/akaromi-firefox/lib/noble.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `noble`  

---

## Overview
`lib/noble.js` is a zero-dependency, constant-time cryptographic bundle derived from the audited `@noble/*` library family (`@noble/hashes`, `@noble/ciphers`, `@noble/curves`). It exposes core primitives for byte manipulation, cryptographic hashing, authenticated stream encryption, and elliptic curve digital signatures.

---

## Features
- **Constant-Time Operations:** Timing-attack resistant byte equality comparisons and modular arithmetic.
- **SHA-256 / SHA-512 & HMAC:** High-performance digest computation with standard HMAC constructions.
- **ChaCha20-Poly1305 AEAD:** Authenticated symmetric stream encryption with 128-bit Poly1305 MAC tags.
- **Curve25519 & Ed25519:** Complete Edwards-curve point addition, scalar multiplication, and digital signature generation/verification.

---

## Step-by-Step Architecture

### ***Step 1***: Binary Encoding, Hex/Base64 Conversion & Constant-Time Buffers

#### **Step 1.1**: Byte Arrays, Hex String Serialization & Parsing
- `bytesToHex(bytes)`: Converts `Uint8Array` buffers into lowercase hexadecimal strings.
- `hexToBytes(hex)`: Parses arbitrary hexadecimal strings into `Uint8Array` byte buffers.
- `utf8ToBytes(str)` / `bytesToUtf8(bytes)`: Fast UTF-8 text encoding and decoding.

#### **Step 1.2**: Constant-Time Memory Equality Checks
- Compares byte arrays using bitwise XOR accumulation without early termination:
```javascript
function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
```

---

### ***Step 2***: Cryptographic Hash Functions & HMAC Engines (SHA-256, SHA-512)

#### **Step 2.1**: Block Compression & Digest State
- **SHA-256:** 512-bit block compression with 64-round non-linear function iteration.
- **SHA-512:** 1024-bit block compression operating on 64-bit word pairs.
- Exposes standard constructor `create()` supporting streaming `.update(data)` and `.digest()`.

#### **Step 2.2**: HMAC Construction
- `hmac(hash, key, message)`: Standard RFC 2104 HMAC implementation using `ipad = 0x36` and `opad = 0x5c` inner/outer key padding.

---

### ***Step 3***: Symmetric Stream Ciphers & AEAD Encryption (ChaCha20-Poly1305)

#### **Step 3.1**: ChaCha20 Quarter-Round Core
- 20-round (10 column, 10 diagonal) stream permutation generating 64-byte keystreams from 256-bit keys and 96-bit nonces.

#### **Step 3.2**: Poly1305 One-Time Authenticator
- Evaluates polynomials over prime field (2^{130} - 5) to generate 16-byte authentication tags.

---

### ***Step 4***: Asymmetric Elliptic Curve Cryptography (Curve25519 & Ed25519)

#### **Step 4.1**: Curve Point Operations & Signature Verification
- Implements twisted Edwards curve ( -x^2 + y^2 = 1 - (121665/121666) x^2 y^2 ).
- Performs public key derivation from 32-byte seeds.
- Verifies Ed25519 digital signatures against message digests.
