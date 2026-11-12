# Vault Cryptography & Key Management Core

> **Source File:** `plugins/akaromi-firefox/lib/crypto.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `IrisCrypto`  

---

## Overview
`lib/crypto.js` is the cryptographic core of Akaromi, providing client-side key derivation, authenticated vault symmetric encryption, cryptographic PIN envelope wrapping, credential generators, and entropy assessment. Plaintext secrets are strictly zeroized in memory upon completion.

---

## Features
- **Scrypt Key Derivation:** Client-side master key derivation (`N=16384, r=8, p=1, dkLen=32`) with `NFKC` normalization.
- **HKDF-SHA256 Vault Key:** Sub-key derivation using domain separation salts.
- **AES-256-GCM Encryption:** Authenticated encryption for all cipher fields producing format `ivHex:authTagHex:cipherHex`.
- **Cryptographic PIN Envelope:** Zero-knowledge PIN unlocking using Scrypt and AES-GCM wrapping.
- **Cryptographically Secure Generators:** Unbiased random password generation and EFF Diceware passphrase generation.
- **Entropy & SSH Keypairs:** Shannon bit calculation and WebCrypto OpenSSH Ed25519/RSA generation.

---

## Step-by-Step Architecture

### ***Step 1***: Cryptographic Memory Zeroization & Ephemeral Key Generation

#### **Step 1.1**: Secure In-Memory Buffer Overwriting
```javascript
IrisCrypto.zeroize = function(buf) {
  if (buf && (buf instanceof Uint8Array || ArrayBuffer.isView(buf))) {
    buf.fill(0);
  }
};
```
Overwrites sensitive keys and passwords in RAM immediately after cryptographic operations.

#### **Step 1.2**: Ephemeral 256-Bit Session Key Generation
`IrisCrypto.generateEphemeralKey()`: Generates 32 random bytes via `crypto.getRandomValues`.

---

### ***Step 2***: Key Derivation Pipelines (Scrypt & HKDF)

#### **Step 2.1**: Master Private Key Decryption via Scrypt + AES-256-GCM
`IrisCrypto.decryptPrivateKey(encryptedPayload, password)`:
1. Parses `saltHex:ivHex:authTagHex:cipherHex`.
2. Derives 32-byte AES key via Scrypt:
   $$	ext{Key} = 	ext{Scrypt}(	ext{password}, 	ext{salt}, N=16384, r=8, p=1, dkLen=32)$$
3. Decrypts private key with AES-256-GCM and immediately zeroizes the derived Scrypt key.

#### **Step 2.2**: Vault Symmetric Key Derivation via HKDF-SHA256
`IrisCrypto.deriveVaultKey(unlockedSecretKey)`:
$$	ext{VaultKey} = 	ext{HKDF-SHA256}(	ext{IKM}=	ext{unlockedSecretKey}, 	ext{salt}=	ext{"iris-pass-salt-v1"}, 	ext{info}=	ext{"iris-pass-vault-v1"}, L=32)$$

---

### ***Step 3***: Authenticated Symmetrical Encryption & Decryption (AES-256-GCM)

#### **Step 3.1**: Plaintext String Encryption & Tag Packing
`IrisCrypto.encryptVaultData(plainText, vaultKeyBytes)`:
- Generates 12-byte cryptographically random IV.
- Encrypts plaintext via AES-256-GCM producing ciphertext + 16-byte authentication tag.
- Returns formatted string `${ivHex}:${authTagHex}:${cipherHex}`.

#### **Step 3.2**: Ciphertext Verification & Decryption
`IrisCrypto.decryptVaultData(encryptedPayload, vaultKeyBytes)`:
- Validates payload structure and authenticates tag before returning decrypted UTF-8 plaintext.
- Throws error immediately if ciphertext was modified or corrupted.

---

### ***Step 4***: Cryptographic PIN Unlock Envelope

#### **Step 4.1**: PIN Scrypt Key Derivation & Vault Key Wrapping
`IrisCrypto.setupPinUnlock(pin, vaultKey)`:
1. Validates `pin.length >= 4`.
2. Generates 16-byte salt and 12-byte IV.
3. Derives 32-byte PIN key via Scrypt (`N=16384, r=8, p=1`).
4. Encrypts the 32-byte `vaultKey` using AES-256-GCM and zeroizes the PIN key.
5. Returns `{ saltHex, ivHex, authTagHex, cipherHex }` persisted in local storage.

#### **Step 4.2**: PIN Unwrapping & Key Authentication
`IrisCrypto.unlockWithPin(pin, pinData)`:
- Recomputes Scrypt key from PIN + stored salt and decrypts the encrypted vault key.
- Throws `"Incorrect PIN"` on tag mismatch.

---

### ***Step 5***: Cryptographically Secure Credential Generators

#### **Step 5.1**: Unbiased Random Password Generator with Ambiguity Filter
`IrisCrypto.generatePassword(options)`:
- Unbiased modulo selection using `crypto.getRandomValues`.
- Character pool selection: uppercase, lowercase, numbers, symbols.
- Optional removal of ambiguous glyphs (`IOlo01{}[]()/`"` etc.).
- Fisher-Yates array shuffling.

#### **Step 5.2**: Diceware EFF Passphrase Generator with Separators & Digits
`IrisCrypto.generatePassphrase(options)`:
- Selects words from an embedded EFF list (516 words) using cryptographic randomness.
- Supports word count (3-32), custom separators (`-`, `_`, `.`), capitalization, and random two-digit insertion (10-99).

---

### ***Step 6***: Shannon Password Entropy & In-Browser SSH Keypair Generation

#### **Step 6.1**: Shannon Entropy Calculation in Bits
$$H = L cdot log_2(R)$$
Where (L) is string length and (R) is the effective pool size (lowercase=26, uppercase=26, digits=10, symbols=33).

#### **Step 6.2**: OpenSSH-Compatible Ed25519 & RSA Keypair Generation
`IrisCrypto.generateSshKeypair(algorithm, comment)`:
- Generates Ed25519 or RSA (2048/4096-bit) keypairs in-browser via `crypto.subtle`.
- Formats OpenSSH public key string and PKCS#8 PEM private key with SHA256 fingerprint.
