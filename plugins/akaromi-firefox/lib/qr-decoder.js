/**
 * IRIS Pass — Lightweight Zero-Dependency Standalone QR Code Decoder
 * Compatible with Browser Background Workers, Content Scripts, and Popup.
 * Uses native BarcodeDetector if available, with robust pure JS fallback.
 */
;(function (root) {
  const IrisQrDecoder = {}

  /**
   * Scan an HTMLImageElement, ImageBitmap, OffscreenCanvas, or HTMLCanvasElement
   */
    // Step 1: Image Source Ingestion & Native Acceleration
  // Step 1.1: Native BarcodeDetector Mediation & Canvas ImageData Extraction
  IrisQrDecoder.scanImage = async function (source) {
    if (!source) return null

    // 1. Try native BarcodeDetector if available
    if (typeof globalThis !== "undefined" && "BarcodeDetector" in globalThis) {
      try {
        const BarcodeDetectorClass = globalThis.BarcodeDetector
        const detector = new BarcodeDetectorClass({ formats: ["qr_code"] })
        const barcodes = await detector.detect(source)
        if (barcodes.length > 0 && barcodes[0]?.rawValue) {
          return barcodes[0].rawValue
        }
      } catch (e) {
        // Fallback to JS decoder
      }
    }

    // 2. Extract ImageData
    let imageData = null
    if (source instanceof ImageData) {
      imageData = source
    } else if (typeof OffscreenCanvas !== "undefined" && (source.width || source.videoWidth)) {
      const w = source.naturalWidth || source.videoWidth || source.width
      const h = source.naturalHeight || source.videoHeight || source.height
      if (w > 0 && h > 0) {
        const canvas = new OffscreenCanvas(w, h)
        const ctx = canvas.getContext("2d")
        ctx.drawImage(source, 0, 0)
        imageData = ctx.getImageData(0, 0, w, h)
      }
    } else if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas")
      const w = source.naturalWidth || source.videoWidth || source.width || 300
      const h = source.naturalHeight || source.videoHeight || source.height || 300
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      ctx.drawImage(source, 0, 0)
      imageData = ctx.getImageData(0, 0, w, h)
    }

    if (!imageData) return null
    return IrisQrDecoder.decodeImageData(imageData)
  }

  // QR Alignment pattern positions table for versions 1 to 10
  const ALIGNMENT_PATTERN_POSITIONS = [
    [],
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
  ]

  // QR Code specification block and EC parameters table (versions 1-10)
  // [totalCodewords, [[ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2], ... for L, M, Q, H]]
  const QR_BLOCK_TABLE = {
    1: [[7, 1, 19], [10, 1, 16], [13, 1, 13], [17, 1, 9]],
    2: [[10, 1, 34], [16, 1, 28], [22, 1, 22], [28, 1, 16]],
    3: [[15, 1, 55], [26, 1, 44], [18, 2, 17], [22, 2, 13]],
    4: [[20, 1, 80], [18, 2, 32], [26, 2, 24], [16, 4, 9]],
    5: [[26, 1, 108], [24, 2, 43], [18, 2, 15, 2, 16], [22, 2, 11, 2, 12]],
    6: [[18, 2, 68], [16, 4, 27], [24, 4, 19], [28, 4, 15]],
    7: [[20, 2, 78], [18, 4, 31], [18, 2, 14, 4, 15], [26, 4, 13, 1, 14]],
    8: [[24, 2, 97], [22, 2, 38, 2, 39], [22, 4, 18, 2, 19], [26, 4, 14, 2, 15]],
    9: [[30, 2, 116], [22, 3, 36, 2, 37], [20, 4, 16, 4, 17], [24, 4, 12, 4, 13]],
    10: [[18, 2, 68, 2, 69], [26, 4, 43, 1, 44], [24, 6, 19, 2, 20], [28, 6, 15, 2, 16]],
  }

  // Galois Field GF(256) for Reed-Solomon Error Correction
  const GF256_EXP = new Uint8Array(512)
  const GF256_LOG = new Uint8Array(256)
  ;(function initGF() {
    let x = 1
    for (let i = 0; i < 255; i++) {
      GF256_EXP[i] = x
      GF256_LOG[x] = i
      x <<= 1
      if (x & 0x100) x ^= 0x11d // QR primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
    }
    for (let i = 255; i < 512; i++) {
      GF256_EXP[i] = GF256_EXP[i - 255]
    }
  })()

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0
    return GF256_EXP[GF256_LOG[a] + GF256_LOG[b]]
  }

  function gfPolyMul(p1, p2) {
    const res = new Uint8Array(p1.length + p2.length - 1)
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        res[i + j] ^= gfMul(p1[i], p2[j])
      }
    }
    return res
  }

  function rsCorrectErrors(codewordBlock, twoS) {
    // Syndrome evaluation
    const syndromes = new Uint8Array(twoS)
    let hasError = false
    for (let i = 0; i < twoS; i++) {
      let syn = 0
      for (let j = 0; j < codewordBlock.length; j++) {
        syn = gfMul(syn, GF256_EXP[i]) ^ codewordBlock[j]
      }
      syndromes[i] = syn
      if (syn !== 0) hasError = true
    }
    if (!hasError) return true // Block is clean

    // Berlekamp-Massey algorithm for error locator polynomial
    let locator = new Uint8Array([1])
    let prevLocator = new Uint8Array([1])
    let prevDiscrepancy = 1
    let shift = 1

    for (let i = 0; i < twoS; i++) {
      let discrepancy = syndromes[i]
      for (let j = 1; j < locator.length; j++) {
        discrepancy ^= gfMul(locator[j], syndromes[i - j])
      }

      if (discrepancy !== 0) {
        const factor = gfMul(discrepancy, GF256_EXP[255 - GF256_LOG[prevDiscrepancy]])
        const term = new Uint8Array(prevLocator.length + shift)
        for (let j = 0; j < prevLocator.length; j++) {
          term[j + shift] = gfMul(prevLocator[j], factor)
        }

        const newLocator = new Uint8Array(Math.max(locator.length, term.length))
        for (let j = 0; j < locator.length; j++) newLocator[j] ^= locator[j]
        for (let j = 0; j < term.length; j++) newLocator[j] ^= term[j]

        if (locator.length <= (i + 1) / 2) {
          prevLocator = locator
          prevDiscrepancy = discrepancy
          shift = 1
        } else {
          shift++
        }
        locator = newLocator
      } else {
        shift++
      }
    }

    const errorCount = locator.length - 1
    if (errorCount * 2 > twoS) return false // Too many errors to correct

    // Find roots of locator polynomial (Chien search)
    const errorPositions = []
    for (let i = 0; i < codewordBlock.length; i++) {
      const xInv = GF256_EXP[255 - i]
      let sum = 0
      for (let j = 0; j < locator.length; j++) {
        sum ^= gfMul(locator[j], GF256_EXP[(j * GF256_LOG[xInv]) % 255])
      }
      if (sum === 0) {
        errorPositions.push(codewordBlock.length - 1 - i)
      }
    }

    if (errorPositions.length !== errorCount) return false

    // Forney algorithm for error values
    // Evaluator polynomial Omega(x) = (S(x) * Lambda(x)) mod x^(2S)
    const omega = new Uint8Array(twoS)
    for (let i = 0; i < twoS; i++) {
      let val = 0
      for (let j = 0; j < locator.length; j++) {
        if (i - j >= 0) val ^= gfMul(locator[j], syndromes[i - j])
      }
      omega[i] = val
    }

    // Derivative of locator polynomial
    const locatorPrime = new Uint8Array(locator.length)
    for (let i = 1; i < locator.length; i += 2) {
      locatorPrime[i - 1] = locator[i]
    }

    for (const pos of errorPositions) {
      const xi = GF256_EXP[pos]
      const xiInv = GF256_EXP[255 - pos]

      let num = 0
      for (let j = 0; j < omega.length; j++) {
        num ^= gfMul(omega[j], GF256_EXP[(j * GF256_LOG[xiInv]) % 255])
      }

      let den = 0
      for (let j = 0; j < locatorPrime.length; j++) {
        den ^= gfMul(locatorPrime[j], GF256_EXP[(j * GF256_LOG[xiInv]) % 255])
      }

      if (den === 0) return false
      const errorVal = gfMul(num, GF256_EXP[255 - GF256_LOG[den]])
      codewordBlock[codewordBlock.length - 1 - pos] ^= errorVal
    }

    return true
  }

  /**
   * Pure JS QR Code Decoder Engine with Adaptive Thresholding & RS Correction
   */
  IrisQrDecoder.decodeImageData = function (imageData) {
    if (!imageData || !imageData.data || imageData.width < 10 || imageData.height < 10) {
      return null
    }

    const { width, height, data } = imageData

    // 1. Convert to Grayscale & Build Integral Image for Bradley-Roth Adaptive Binarization
    const grays = new Uint8Array(width * height)
    const integral = new Float64Array((width + 1) * (height + 1))

    for (let y = 0; y < height; y++) {
      let rowSum = 0
      const rowOffset = y * width
      const intRowOffset = (y + 1) * (width + 1)
      const prevIntRowOffset = y * (width + 1)

      for (let x = 0; x < width; x++) {
        const idx = (rowOffset + x) * 4
        // Perceived luminance: 0.299 R + 0.587 G + 0.114 B
        const g = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8
        grays[rowOffset + x] = g
        rowSum += g
        integral[intRowOffset + (x + 1)] = integral[prevIntRowOffset + (x + 1)] + rowSum
      }
    }

    // Adaptive Thresholding Window: s = width / 8
    const s = Math.max(4, (width / 8) | 0)
    const s2 = (s / 2) | 0
    const t = 0.15 // 15% darker than local average = black module
    const binarized = new Uint8Array(width * height)

    for (let y = 0; y < height; y++) {
      const y1 = Math.max(0, y - s2)
      const y2 = Math.min(height, y + s2)
      const rowOffset = y * width

      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - s2)
        const x2 = Math.min(width, x + s2)
        const count = (x2 - x1) * (y2 - y1)

        const sum =
          integral[y2 * (width + 1) + x2] -
          integral[y1 * (width + 1) + x2] -
          integral[y2 * (width + 1) + x1] +
          integral[y1 * (width + 1) + x1]

        const localAvg = sum / count
        binarized[rowOffset + x] = grays[rowOffset + x] < localAvg * (1 - t) ? 1 : 0
      }
    }

    function getPixel(x, y) {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0
      return binarized[y * width + x]
    }

    // 2. Locate 1:1:3:1:1 Finder Patterns
    const possibleCenters = []
    const stateCount = [0, 0, 0, 0, 0]

    function checkRatio(state) {
      let total = 0
      for (let i = 0; i < 5; i++) {
        const count = state[i]
        if (count === 0) return false
        total += count
      }
      if (total < 7) return false
      const moduleSize = total / 7.0
      const maxVariance = moduleSize / 1.5
      return (
        Math.abs(moduleSize - state[0]) < maxVariance &&
        Math.abs(moduleSize - state[1]) < maxVariance &&
        Math.abs(3.0 * moduleSize - state[2]) < 3.0 * maxVariance &&
        Math.abs(moduleSize - state[3]) < maxVariance &&
        Math.abs(moduleSize - state[4]) < maxVariance
      )
    }

    function checkVertical(startX, startY, maxCount, originalTotal) {
      const vState = [0, 0, 0, 0, 0]
      let y = startY
      while (y >= 0 && getPixel(startX, y)) { vState[2]++; y-- }
      if (y < 0) return NaN
      while (y >= 0 && !getPixel(startX, y) && vState[1] <= maxCount) { vState[1]++; y-- }
      if (y < 0 || vState[1] > maxCount) return NaN
      while (y >= 0 && getPixel(startX, y) && vState[0] <= maxCount) { vState[0]++; y-- }
      if (vState[0] > maxCount) return NaN

      y = startY + 1
      while (y < height && getPixel(startX, y)) { vState[2]++; y++ }
      if (y >= height) return NaN
      while (y < height && !getPixel(startX, y) && vState[3] <= maxCount) { vState[3]++; y++ }
      if (y >= height || vState[3] > maxCount) return NaN
      while (y < height && getPixel(startX, y) && vState[4] <= maxCount) { vState[4]++; y++ }
      if (vState[4] > maxCount) return NaN

      const total = vState[0] + vState[1] + vState[2] + vState[3] + vState[4]
      if (5 * Math.abs(total - originalTotal) >= 2 * originalTotal) return NaN

      return checkRatio(vState) ? y - vState[4] - vState[3] - vState[2] / 2.0 : NaN
    }

    // Horizontal row scanning for finders
    for (let y = 0; y < height; y += 2) {
      stateCount[0] = 0; stateCount[1] = 0; stateCount[2] = 0; stateCount[3] = 0; stateCount[4] = 0
      let currentState = 0

      for (let x = 0; x < width; x++) {
        if (getPixel(x, y)) {
          if ((currentState & 1) === 1) currentState++
          stateCount[currentState]++
        } else {
          if ((currentState & 1) === 0) {
            if (currentState === 4) {
              if (checkRatio(stateCount)) {
                const totalCount = stateCount[0] + stateCount[1] + stateCount[2] + stateCount[3] + stateCount[4]
                const centerCol = x - stateCount[4] - stateCount[3] - stateCount[2] / 2.0
                const centerRow = checkVertical(centerCol | 0, y, stateCount[2], totalCount)
                if (!isNaN(centerRow)) {
                  const estModuleSize = totalCount / 7.0
                  let found = false
                  for (let i = 0; i < possibleCenters.length; i++) {
                    const p = possibleCenters[i]
                    if (Math.abs(p.y - centerRow) < estModuleSize * 1.5 && Math.abs(p.x - centerCol) < estModuleSize * 1.5) {
                      p.count++
                      found = true
                      break
                    }
                  }
                  if (!found) {
                    possibleCenters.push({ x: centerCol, y: centerRow, size: estModuleSize, count: 1 })
                  }
                }
              }
              stateCount[0] = stateCount[2]
              stateCount[1] = stateCount[3]
              stateCount[2] = stateCount[4]
              stateCount[3] = 1
              stateCount[4] = 0
              currentState = 3
            } else {
              currentState++
              stateCount[currentState]++
            }
          } else {
            stateCount[currentState]++
          }
        }
      }
    }

    if (possibleCenters.length < 3) return null

    possibleCenters.sort((a, b) => b.count - a.count)
    const patterns = possibleCenters.slice(0, 3)

    function distance(p1, p2) {
      const dx = p1.x - p2.x
      const dy = p1.y - p2.y
      return Math.sqrt(dx * dx + dy * dy)
    }

    const d01 = distance(patterns[0], patterns[1])
    const d12 = distance(patterns[1], patterns[2])
    const d02 = distance(patterns[0], patterns[2])

    let topLeft, topRight, bottomLeft
    if (d12 >= d01 && d12 >= d02) {
      topLeft = patterns[0]; topRight = patterns[1]; bottomLeft = patterns[2]
    } else if (d02 >= d01 && d02 >= d12) {
      topLeft = patterns[1]; topRight = patterns[0]; bottomLeft = patterns[2]
    } else {
      topLeft = patterns[2]; topRight = patterns[0]; bottomLeft = patterns[1]
    }

    // Orient top-right vs bottom-left via cross product
    const crossProduct =
      (topRight.x - topLeft.x) * (bottomLeft.y - topLeft.y) -
      (topRight.y - topLeft.y) * (bottomLeft.x - topLeft.x)
    if (crossProduct < 0) {
      const temp = topRight
      topRight = bottomLeft
      bottomLeft = temp
    }

    const avgModuleSize = (topLeft.size + topRight.size + bottomLeft.size) / 3.0
    if (avgModuleSize <= 0) return null

    const distTop = distance(topLeft, topRight)
    const distLeft = distance(topLeft, bottomLeft)
    const dimEstimate = Math.round((distTop + distLeft) / (2 * avgModuleSize)) + 7

    const version = Math.max(1, Math.min(10, Math.round((dimEstimate - 17) / 4)))
    const gridDimension = 4 * version + 17

    // 3. Grid Sampling with Finder Center Offset (+3.5 modules)
    // Finder centers are at (3.5, 3.5), (gridDimension - 3.5, 3.5), (3.5, gridDimension - 3.5)
    // Span between finder centers is (gridDimension - 7) modules
    const span = gridDimension - 7
    const grid = []

    for (let r = 0; r < gridDimension; r++) {
      grid[r] = new Uint8Array(gridDimension)
      const v = (r - 3) / span // relative position along vertical axis

      for (let c = 0; c < gridDimension; c++) {
        const u = (c - 3) / span // relative position along horizontal axis

        const px =
          (1 - u) * (1 - v) * topLeft.x +
          u * (1 - v) * topRight.x +
          (1 - u) * v * bottomLeft.x +
          u * v * (topRight.x + bottomLeft.x - topLeft.x)

        const py =
          (1 - u) * (1 - v) * topLeft.y +
          u * (1 - v) * topRight.y +
          (1 - u) * v * bottomLeft.y +
          u * v * (topRight.y + bottomLeft.y - topLeft.y)

        grid[r][c] = getPixel(Math.round(px), Math.round(py))
      }
    }

    // 4. Format Information Decoding (Mask pattern & EC level)
    let formatBits1 = 0
    for (let i = 0; i <= 5; i++) formatBits1 = (formatBits1 << 1) | grid[8][i]
    formatBits1 = (formatBits1 << 1) | grid[8][7]
    formatBits1 = (formatBits1 << 1) | grid[8][8]
    formatBits1 = (formatBits1 << 1) | grid[7][8]
    for (let i = 5; i >= 0; i--) formatBits1 = (formatBits1 << 1) | grid[i][8]

    const formatInfo = formatBits1 ^ 0x5412
    const ecLevelCode = (formatInfo >> 13) & 0x03 // 01=L, 00=M, 11=Q, 10=H
    const maskPattern = (formatInfo >> 10) & 0x07

    // Map 2-bit EC code to index in QR_BLOCK_TABLE: 0=L, 1=M, 2=Q, 3=H
    const ecIndex = ecLevelCode === 1 ? 0 : ecLevelCode === 0 ? 1 : ecLevelCode === 3 ? 2 : 3

    function isMasked(row, col, pattern) {
      switch (pattern) {
        case 0: return (row + col) % 2 === 0
        case 1: return row % 2 === 0
        case 2: return col % 3 === 0
        case 3: return (row + col) % 3 === 0
        case 4: return (((row / 2) | 0) + ((col / 3) | 0)) % 2 === 0
        case 5: return ((row * col) % 2) + ((row * col) % 3) === 0
        case 6: return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0
        case 7: return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0
        default: return false
      }
    }

    const alignmentCoords = ALIGNMENT_PATTERN_POSITIONS[version] || []

    function isFunctionModule(row, col, dim) {
      // Finders & separators
      if (row <= 8 && col <= 8) return true
      if (row <= 8 && col >= dim - 8) return true
      if (row >= dim - 8 && col <= 8) return true
      // Timing lines
      if (row === 6 || col === 6) return true
      // Alignment patterns (5x5 around center)
      for (const ar of alignmentCoords) {
        for (const ac of alignmentCoords) {
          // Avoid corners occupied by finders
          if ((ar === 6 && ac === 6) || (ar === 6 && ac === dim - 7) || (ar === dim - 7 && ac === 6)) {
            continue
          }
          if (Math.abs(row - ar) <= 2 && Math.abs(col - ac) <= 2) {
            return true
          }
        }
      }
      return false
    }

    // 5. Read Unmasked Data Bits in 2-column Zig-Zag
    const rawBits = []
    let readingUp = true
    for (let right = gridDimension - 1; right > 0; right -= 2) {
      if (right === 6) right-- // Skip vertical timing column

      for (let count = 0; count < gridDimension; count++) {
        const r = readingUp ? gridDimension - 1 - count : count
        for (let colOffset = 0; colOffset < 2; colOffset++) {
          const c = right - colOffset
          if (!isFunctionModule(r, c, gridDimension)) {
            let bit = grid[r][c]
            if (isMasked(r, c, maskPattern)) {
              bit ^= 1
            }
            rawBits.push(bit)
          }
        }
      }
      readingUp = !readingUp
    }

    // Convert raw bits to codewords
    const rawCodewords = []
    for (let i = 0; i + 8 <= rawBits.length; i += 8) {
      let byte = 0
      for (let b = 0; b < 8; b++) {
        byte = (byte << 1) | rawBits[i + b]
      }
      rawCodewords.push(byte)
    }

    // 6. De-interleave Blocks & Apply Reed-Solomon Error Correction
    const blockSpec = QR_BLOCK_TABLE[version]?.[ecIndex]
    let correctedDataCodewords = []

    if (blockSpec) {
      const ecPerBlock = blockSpec[0]
      const numBlocks1 = blockSpec[1]
      const dataPerBlock1 = blockSpec[2]
      const numBlocks2 = blockSpec[3] || 0
      const dataPerBlock2 = blockSpec[4] || 0
      const totalBlocks = numBlocks1 + numBlocks2

      const blocks = Array.from({ length: totalBlocks }, () => [])
      let cwIdx = 0

      // De-interleave data codewords
      const maxDataCodewords = Math.max(dataPerBlock1, dataPerBlock2)
      for (let d = 0; d < maxDataCodewords; d++) {
        for (let b = 0; b < totalBlocks; b++) {
          const blockCap = b < numBlocks1 ? dataPerBlock1 : dataPerBlock2
          if (d < blockCap && cwIdx < rawCodewords.length) {
            blocks[b].push(rawCodewords[cwIdx++])
          }
        }
      }

      // De-interleave EC codewords
      const ecBlocks = Array.from({ length: totalBlocks }, () => [])
      for (let e = 0; e < ecPerBlock; e++) {
        for (let b = 0; b < totalBlocks; b++) {
          if (cwIdx < rawCodewords.length) {
            ecBlocks[b].push(rawCodewords[cwIdx++])
          }
        }
      }

      // Verify and correct each block
      for (let b = 0; b < totalBlocks; b++) {
        const fullBlock = new Uint8Array(blocks[b].length + ecBlocks[b].length)
        fullBlock.set(blocks[b], 0)
        fullBlock.set(ecBlocks[b], blocks[b].length)

        rsCorrectErrors(fullBlock, ecPerBlock)
        for (let i = 0; i < blocks[b].length; i++) {
          correctedDataCodewords.push(fullBlock[i])
        }
      }
    } else {
      correctedDataCodewords = rawCodewords
    }

    // 7. Parse QR Data Payload Modes
    let bitIndex = 0
    const bitStream = []
    for (const byte of correctedDataCodewords) {
      for (let b = 7; b >= 0; b--) {
        bitStream.push((byte >> b) & 1)
      }
    }

    function readBits(num) {
      let res = 0
      for (let i = 0; i < num; i++) {
        if (bitIndex < bitStream.length) {
          res = (res << 1) | bitStream[bitIndex++]
        }
      }
      return res
    }

    let decodedText = ""
    while (bitIndex + 4 <= bitStream.length) {
      const mode = readBits(4)
      if (mode === 0) break // Terminator

      if (mode === 4) {
        // 8-bit Byte mode
        const count = readBits(version <= 9 ? 8 : 16)
        const bytes = []
        for (let i = 0; i < count; i++) {
          if (bitIndex + 8 <= bitStream.length) {
            bytes.push(readBits(8))
          }
        }
        try {
          decodedText += new TextDecoder("utf-8").decode(new Uint8Array(bytes))
        } catch {
          decodedText += String.fromCharCode(...bytes)
        }
      } else if (mode === 2) {
        // Alphanumeric mode
        const ALPHANUMERIC_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"
        const count = readBits(version <= 9 ? 9 : 11)
        for (let i = 0; i < count - 1; i += 2) {
          const val = readBits(11)
          decodedText += ALPHANUMERIC_CHARS[(val / 45) | 0]
          decodedText += ALPHANUMERIC_CHARS[val % 45]
        }
        if (count % 2 === 1) {
          const val = readBits(6)
          decodedText += ALPHANUMERIC_CHARS[val]
        }
      } else if (mode === 1) {
        // Numeric mode
        const count = readBits(version <= 9 ? 10 : 12)
        for (let i = 0; i < count - 2; i += 3) {
          const val = readBits(10)
          decodedText += val.toString().padStart(3, "0")
        }
        const rem = count % 3
        if (rem === 1) {
          decodedText += readBits(4).toString()
        } else if (rem === 2) {
          decodedText += readBits(7).toString().padStart(2, "0")
        }
      } else {
        break
      }
    }

    return decodedText.trim() || null
  }

  root.IrisQrDecoder = IrisQrDecoder
})(typeof self !== "undefined" ? self : this)
