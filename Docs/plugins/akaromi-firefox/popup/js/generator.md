# In-Popup Password & Passphrase Generator

> **Source File:** `plugins/akaromi-firefox/popup/js/generator.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `AkaromiGenerator`  

---

## Overview
`popup/js/generator.js` controls the in-popup credential generator interface for passwords and Diceware passphrases.

---

## Features
- **Password Generator:** Configurable length (8-64), character classes, and ambiguity filter.
- **Passphrase Generator:** EFF Diceware wordlist, word count (3-10), separators, capitalization, and digits.
- **Entropy Meter:** Live Shannon entropy calculation with strength visualization.
- **Direct Injection:** Inserts generated credentials into editor fields or copies to clipboard.

---

## Step-by-Step Architecture

### ***Step 1***: Generator Configuration & Real-Time Preview

#### **Step 1.1**: Random Password & Diceware Passphrase Generation with Real-Time Entropy
`updateGeneratorPreview()`: Generates credential and calculates Shannon entropy score in bits with color-coded rating bar.

---

### ***Step 2***: Target Field Insertion & Clipboard Copy

#### **Step 2.1**: Target Field Injection & Clipboard Copy with Scheduled Sanitation
- `btnGenUse`: Injects generated password directly into active editor input.
- `btnGenCopy`: Copies to clipboard with automated sanitation timer.
