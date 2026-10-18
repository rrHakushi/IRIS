/**
 * Akaromi for Firefox — Background Passkey / WebAuthn Cryptography
 */

function bufferToBase64Url(buf) {
  if (!buf) return ""
  let bytes
  if (buf instanceof Uint8Array) {
    bytes = buf
  } else if (ArrayBuffer.isView(buf)) {
    bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  } else if (buf instanceof ArrayBuffer) {
    bytes = new Uint8Array(buf)
  } else if (typeof buf === "string") {
    return buf
  } else {
    try {
      bytes = new Uint8Array(buf)
    } catch {
      return ""
    }
  }
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function base64UrlToBuffer(str) {
  if (!str) return new ArrayBuffer(0)
  const base64 =
    str.replace(/-/g, "+").replace(/_/g, "/") +
    "==".slice(0, (4 - (str.length % 4)) % 4)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function encodeCborAttestation(authData) {
  const parts = []
  parts.push(0xa3) // map(3)

  // "fmt": "none"
  parts.push(0x63, 0x66, 0x6d, 0x74) // key "fmt"
  parts.push(0x64, 0x6e, 0x6f, 0x6e, 0x65) // val "none"

  // "attStmt": {}
  parts.push(0x67, 0x61, 0x74, 0x74, 0x53, 0x74, 0x6d, 0x74) // key "attStmt"
  parts.push(0xa0) // empty map

  // "authData": bytes
  parts.push(0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61) // key "authData"
  if (authData.length < 256) {
    parts.push(0x58, authData.length)
  } else {
    parts.push(0x59, (authData.length >> 8) & 0xff, authData.length & 0xff)
  }
  for (let i = 0; i < authData.length; i++) {
    parts.push(authData[i])
  }

  return new Uint8Array(parts).buffer
}

function rawToDerSignature(rawSig) {
  const r = rawSig.slice(0, 32)
  const s = rawSig.slice(32, 64)

  function trimLeadingZeros(arr) {
    let i = 0
    while (i < arr.length - 1 && arr[i] === 0) i++
    return arr.slice(i)
  }

  let rTrim = trimLeadingZeros(r)
  let sTrim = trimLeadingZeros(s)

  if (rTrim[0] & 0x80) {
    const padded = new Uint8Array(rTrim.length + 1)
    padded.set(rTrim, 1)
    rTrim = padded
  }
  if (sTrim[0] & 0x80) {
    const padded = new Uint8Array(sTrim.length + 1)
    padded.set(sTrim, 1)
    sTrim = padded
  }

  const totalLen = 2 + rTrim.length + 2 + sTrim.length
  const der = new Uint8Array(2 + totalLen)
  let offset = 0

  der[offset++] = 0x30 // SEQUENCE
  der[offset++] = totalLen
  der[offset++] = 0x02 // INTEGER (r)
  der[offset++] = rTrim.length
  der.set(rTrim, offset)
  offset += rTrim.length
  der[offset++] = 0x02 // INTEGER (s)
  der[offset++] = sTrim.length
  der.set(sTrim, offset)

  return der
}
