# Standalone Computer Vision & QR Code Decoder Engine

> **Source File:** `plugins/akaromi-firefox/lib/qr-decoder.js`  
> **Document Type:** Diátaxis Technical Reference  
> **Module ID:** `IrisQrDecoder`  

---

## Overview
`lib/qr-decoder.js` is a pure-JavaScript QR code computer-vision engine designed to decode 2FA TOTP QR codes from screen snipping and image files without external libraries.

---

## Features
- **Hardware Acceleration:** Uses native browser `BarcodeDetector` when available.
- **Bradley-Roth Adaptive Binarization:** Single-pass integral image local thresholding.
- **1:1:3:1:1 Finder Pattern Detection:** Horizontal and vertical scanline ratio validation.
- **+3.5 Module Calibration:** Accurate center alignment with QR grid coordinates.
- **Galois Field GF(256) Reed-Solomon:** Berlekamp-Massey error syndrome solver.

---

## Step-by-Step Architecture

### ***Step 1***: Image Source Ingestion & Native Acceleration

#### **Step 1.1**: Native BarcodeDetector Mediation & Canvas ImageData Extraction
`IrisQrDecoder.scanImage(source)`:
- Checks `window.BarcodeDetector` first for native C++ performance.
- Falls back to pure-JS decoder via `OffscreenCanvas` or `HTMLCanvasElement` pixel extraction.

---

### ***Step 2***: Bradley-Roth Adaptive Binarization

#### **Step 2.1**: Single-Pass Integral Image Table Construction & Local Thresholding
`binarizeAdaptive(pixels, width, height)`:
- Computes integral image table (I(x, y) = sum 	ext{pixel}(i, j)).
- Evaluates local window ((1/8) image dimension) with a 15% intensity drop threshold:
  $$	ext{Threshold} = rac{	ext{LocalSum}}{	ext{LocalCount}} cdot 0.85$$
- Handles low contrast, shadows, and screen glare seamlessly.

---

### ***Step 3***: Finder Pattern Detection & Center Calibration

#### **Step 3.1**: 1:1:3:1:1 Ratio Scanning & +3.5 Module Center Offset Calibration
`findPatterns(grid, width, height)`:
- Locates 3 canonical corner finder patterns.
- Applies cross-axis confirmation and distance clustering.
- Applies **+3.5 module offset** to translate pattern boundary to module center.

---

### ***Step 4***: Alignment Patterns & Perspective Transform

#### **Step 4.1**: Alignment Pattern Grid Fitting & Homography Matrix Warping
- Resolves alignment patterns for QR versions 1 through 10.
- Computes perspective transformation matrix to rectify skewed or angled screen captures.

---

### ***Step 5***: Reed-Solomon Error Correction & Stream Decoding

#### **Step 5.1**: Galois Field GF(256) Berlekamp-Massey Syndrome Decoding & Mode Extraction
`correctErrors(codewords, numDataCodewords)`:
- Computes error syndromes over (	ext{GF}(2^8)) with generator polynomial (x^8 + x^4 + x^3 + x^2 + 1) (`0x11d`).
- Corrects corrupted codewords and unpacks data streams (Numeric, Alphanumeric, Byte UTF-8, Kanji).
