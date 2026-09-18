/**
 * IRIS Pass — Lightweight Zero-Dependency Standalone QR Code Decoder
 * Compatible with Browser Background Workers, Content Scripts, and Popup.
 * Uses native BarcodeDetector if available, otherwise pure JS sampling & decoding.
 */
;(function (root) {
  const IrisQrDecoder = {}

  /**
   * Scan an HTMLImageElement, ImageBitmap, OffscreenCanvas, or HTMLCanvasElement
   */
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

  /**
   * Pure JS QR Code Decoder Engine
   */
  IrisQrDecoder.decodeImageData = function (imageData) {
    if (!imageData || !imageData.data || imageData.width < 10 || imageData.height < 10) {
      return null
    }

    const { width, height, data } = imageData

    // 1. Convert to Grayscale & Calculate Binarization Threshold
    const grays = new Uint8Array(width * height)
    let sum = 0
    const totalPixels = width * height
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Perceived luminance: 0.299 R + 0.587 G + 0.114 B
      const g = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8
      grays[j] = g
      sum += g
    }
    const avgThreshold = (sum / totalPixels) | 0

    // 2. Find 1:1:3:1:1 Finder Patterns
    const binarized = new Uint8Array(totalPixels)
    for (let i = 0; i < totalPixels; i++) {
      binarized[i] = grays[i] < avgThreshold ? 1 : 0 // 1 = dark, 0 = light
    }

    function getPixel(x, y) {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0
      return binarized[y * width + x]
    }

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
      const maxVariance = moduleSize / 2.0
      return (
        Math.abs(moduleSize - state[0]) < maxVariance &&
        Math.abs(moduleSize - state[1]) < maxVariance &&
        Math.abs(3.0 * moduleSize - state[2]) < 3.0 * maxVariance &&
        Math.abs(moduleSize - state[3]) < maxVariance &&
        Math.abs(moduleSize - state[4]) < maxVariance
      )
    }

    function checkVertical(startX, startY, maxCount, originalStateCountTotal) {
      const vState = [0, 0, 0, 0, 0]
      let y = startY
      while (y >= 0 && getPixel(startX, y)) {
        vState[2]++
        y--
      }
      if (y < 0) return NaN
      while (y >= 0 && !getPixel(startX, y) && vState[1] <= maxCount) {
        vState[1]++
        y--
      }
      if (y < 0 || vState[1] > maxCount) return NaN
      while (y >= 0 && getPixel(startX, y) && vState[0] <= maxCount) {
        vState[0]++
        y--
      }
      if (vState[0] > maxCount) return NaN

      y = startY + 1
      while (y < height && getPixel(startX, y)) {
        vState[2]++
        y++
      }
      if (y >= height) return NaN
      while (y < height && !getPixel(startX, y) && vState[3] <= maxCount) {
        vState[3]++
        y++
      }
      if (y >= height || vState[3] > maxCount) return NaN
      while (y < height && getPixel(startX, y) && vState[4] <= maxCount) {
        vState[4]++
        y++
      }
      if (vState[4] > maxCount) return NaN

      const total = vState[0] + vState[1] + vState[2] + vState[3] + vState[4]
      if (5 * Math.abs(total - originalStateCountTotal) >= 2 * originalStateCountTotal) {
        return NaN
      }

      return checkRatio(vState) ? y - vState[4] - vState[3] - vState[2] / 2.0 : NaN
    }

    // Scan lines for finder pattern
    for (let y = 0; y < height; y += 2) {
      stateCount[0] = 0
      stateCount[1] = 0
      stateCount[2] = 0
      stateCount[3] = 0
      stateCount[4] = 0
      let currentState = 0

      for (let x = 0; x < width; x++) {
        if (getPixel(x, y)) {
          // Black pixel
          if ((currentState & 1) === 1) {
            currentState++
          }
          stateCount[currentState]++
        } else {
          // White pixel
          if ((currentState & 1) === 0) {
            if (currentState === 4) {
              if (checkRatio(stateCount)) {
                const totalCount =
                  stateCount[0] +
                  stateCount[1] +
                  stateCount[2] +
                  stateCount[3] +
                  stateCount[4]
                const centerCol =
                  x - stateCount[4] - stateCount[3] - stateCount[2] / 2.0
                const centerRow = checkVertical(
                  centerCol | 0,
                  y,
                  stateCount[2],
                  totalCount
                )
                if (!isNaN(centerRow)) {
                  const estModuleSize = totalCount / 7.0
                  let found = false
                  for (let i = 0; i < possibleCenters.length; i++) {
                    const p = possibleCenters[i]
                    if (
                      Math.abs(p.y - centerRow) < estModuleSize &&
                      Math.abs(p.x - centerCol) < estModuleSize
                    ) {
                      p.count++
                      found = true
                      break
                    }
                  }
                  if (!found) {
                    possibleCenters.push({
                      x: centerCol,
                      y: centerRow,
                      size: estModuleSize,
                      count: 1,
                    })
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

    if (possibleCenters.length < 3) {
      return null
    }

    // Sort by pattern occurrences
    possibleCenters.sort((a, b) => b.count - a.count)
    const patterns = possibleCenters.slice(0, 3)

    // Distance between finder patterns
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
      topLeft = patterns[0]
      topRight = patterns[1]
      bottomLeft = patterns[2]
    } else if (d02 >= d01 && d02 >= d12) {
      topLeft = patterns[1]
      topRight = patterns[0]
      bottomLeft = patterns[2]
    } else {
      topLeft = patterns[2]
      topRight = patterns[0]
      bottomLeft = patterns[1]
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

    const moduleSize =
      (topLeft.size + topRight.size + bottomLeft.size) / 3.0
    if (moduleSize <= 0) return null

    const dimEstimate =
      Math.round(
        (distance(topLeft, topRight) + distance(topLeft, bottomLeft)) /
          (2 * moduleSize)
      ) + 7
    // QR dimension: 4 * version + 17 (e.g. 21, 25, 29, 33...)
    const gridDimension = Math.max(
      21,
      Math.min(177, Math.round((dimEstimate - 17) / 4) * 4 + 17)
    )

    // Sample Grid into 2D Boolean Array
    const grid = []
    for (let r = 0; r < gridDimension; r++) {
      grid[r] = new Uint8Array(gridDimension)
      for (let c = 0; c < gridDimension; c++) {
        const u = c / (gridDimension - 1)
        const v = r / (gridDimension - 1)

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

    // Decode Format Info (Mask pattern & EC level)
    let formatBits1 = 0
    for (let i = 0; i <= 5; i++) formatBits1 = (formatBits1 << 1) | grid[8][i]
    formatBits1 = (formatBits1 << 1) | grid[8][7]
    formatBits1 = (formatBits1 << 1) | grid[8][8]
    formatBits1 = (formatBits1 << 1) | grid[7][8]
    for (let i = 5; i >= 0; i--) formatBits1 = (formatBits1 << 1) | grid[i][8]

    // Unmask format bits with 0x5412
    const formatInfo = formatBits1 ^ 0x5412
    const maskPattern = (formatInfo >> 10) & 0x07

    function isMasked(row, col, pattern) {
      switch (pattern) {
        case 0:
          return (row + col) % 2 === 0
        case 1:
          return row % 2 === 0
        case 2:
          return col % 3 === 0
        case 3:
          return (row + col) % 3 === 0
        case 4:
          return (((row / 2) | 0) + ((col / 3) | 0)) % 2 === 0
        case 5:
          return ((row * col) % 2) + ((row * col) % 3) === 0
        case 6:
          return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0
        case 7:
          return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0
        default:
          return false
      }
    }

    function isFunctionModule(row, col, dim) {
      // Top-left finder & separators
      if (row <= 8 && col <= 8) return true
      // Top-right finder & separators
      if (row <= 8 && col >= dim - 8) return true
      // Bottom-left finder & separators
      if (row >= dim - 8 && col <= 8) return true
      // Timing patterns
      if (row === 6 || col === 6) return true
      return false
    }

    // Read Data Bits in 2-column Zig-Zag
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
              bit = bit ^ 1
            }
            rawBits.push(bit)
          }
        }
      }
      readingUp = !readingUp
    }

    // Bitstream Reader
    let bitIndex = 0
    function readBits(num) {
      let res = 0
      for (let i = 0; i < num; i++) {
        if (bitIndex < rawBits.length) {
          res = (res << 1) | rawBits[bitIndex++]
        }
      }
      return res
    }

    // Decode Mode and Payload
    let decodedText = ""
    while (bitIndex + 4 <= rawBits.length) {
      const mode = readBits(4)
      if (mode === 0) break // Terminator

      if (mode === 4) {
        // 8-bit Byte mode
        const count = readBits(gridDimension <= 26 ? 8 : 16)
        const bytes = []
        for (let i = 0; i < count; i++) {
          if (bitIndex + 8 <= rawBits.length) {
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
        const ALPHANUMERIC_CHARS =
          "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"
        const count = readBits(gridDimension <= 26 ? 9 : 11)
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
        const count = readBits(gridDimension <= 26 ? 10 : 12)
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
        // Unsupported/end
        break
      }
    }

    return decodedText.trim() || null
  }

  root.IrisQrDecoder = IrisQrDecoder
})(typeof self !== "undefined" ? self : this)
