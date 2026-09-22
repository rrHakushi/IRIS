/**
 * IRIS Pass — Cryptographic Core
 * Compatible with @IRIS/web and @IRIS/elysia (@noble/hashes, @noble/ciphers)
 */
;(function (root) {
  const IrisCrypto = {}

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const noble =
    root.noble || (typeof globalThis !== "undefined" ? globalThis.noble : null)

  function bytesToHex(bytes) {
    if (noble?.bytesToHex) return noble.bytesToHex(bytes)
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  }

  function hexToBytes(hex) {
    if (noble?.hexToBytes) return noble.hexToBytes(hex)
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
    }
    return bytes
  }

  IrisCrypto.bytesToHex = bytesToHex
  IrisCrypto.hexToBytes = hexToBytes

  const VAULT_SALT = encoder.encode("iris-pass-salt-v1")
  const VAULT_INFO = encoder.encode("iris-pass-vault-v1")

  /**
   * Decrypts the user's master secret key using password with scrypt + AES-256-GCM.
   * Format of encryptedPrivateKey: saltHex:ivHex:authTagHex:cipherHex
   * Exactly matching apps/web/lib/encryption-vault.ts: decryptPrivateKeyClient()
   * and apps/elysia/src/utils/auth-crypto.ts: encryptPrivateKey()
   */
  IrisCrypto.decryptPrivateKey = function (encryptedPayload, password) {
    if (!noble) throw new Error("Cryptographic module (noble) not loaded")

    const parts = encryptedPayload.split(":")
    if (parts.length !== 4) {
      throw new Error("Invalid encrypted private key format")
    }

    const [saltHex, ivHex, authTagHex, cipherHex] = parts
    if (!saltHex || !ivHex || !authTagHex || !cipherHex) {
      throw new Error("Invalid encrypted private key segment")
    }

    const salt = hexToBytes(saltHex)
    const iv = hexToBytes(ivHex)
    const authTag = hexToBytes(authTagHex)
    const cipher = hexToBytes(cipherHex)

    // Scrypt key derivation (32 bytes AES-256 key, matching Node.js scryptAsync default params)
    const key = noble.scrypt(password.normalize("NFKC"), salt, {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 32,
    })

    // Recombine ciphertext + 16-byte auth tag for @noble/ciphers AES-GCM
    const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
    ciphertextWithTag.set(cipher, 0)
    ciphertextWithTag.set(authTag, cipher.length)

    const aes = noble.gcm(key, iv)
    return aes.decrypt(ciphertextWithTag)
  }

  /**
   * Derives 256-bit vault key from raw secret key bytes via HKDF-SHA256
   * Exactly matching apps/web/lib/pass-crypto.ts: deriveVaultKey()
   */
  IrisCrypto.deriveVaultKey = function (unlockedSecretKey) {
    if (!noble) throw new Error("Cryptographic module (noble) not loaded")
    return noble.hkdf(
      noble.sha256,
      unlockedSecretKey,
      VAULT_SALT,
      VAULT_INFO,
      32
    )
  }

  /**
   * Encrypts plaintext string using AES-256-GCM and VaultKey
   * Format: ivHex:authTagHex:cipherHex
   * Exactly matching apps/web/lib/pass-crypto.ts: encryptVaultData()
   */
  IrisCrypto.encryptVaultData = function (plainText, vaultKeyBytes) {
    if (!noble) throw new Error("Cryptographic module (noble) not loaded")

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plainBytes = encoder.encode(plainText)

    const aes = noble.gcm(vaultKeyBytes, iv)
    const ciphertextWithTag = aes.encrypt(plainBytes)

    const cipher = ciphertextWithTag.slice(0, -16)
    const authTag = ciphertextWithTag.slice(-16)

    return `${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(cipher)}`
  }

  /**
   * Decrypts ivHex:authTagHex:cipherHex using AES-256-GCM and VaultKey
   * Exactly matching apps/web/lib/pass-crypto.ts: decryptVaultData()
   */
  IrisCrypto.decryptVaultData = function (encryptedPayload, vaultKeyBytes) {
    if (!noble) throw new Error("Cryptographic module (noble) not loaded")

    const parts = encryptedPayload.split(":")
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format")
    }

    const [ivHex, authTagHex, cipherHex] = parts
    if (!ivHex || !authTagHex || !cipherHex) {
      throw new Error("Missing encrypted payload segments")
    }

    const iv = hexToBytes(ivHex)
    const authTag = hexToBytes(authTagHex)
    const cipher = hexToBytes(cipherHex)

    const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
    ciphertextWithTag.set(cipher, 0)
    ciphertextWithTag.set(authTag, cipher.length)

    const aes = noble.gcm(vaultKeyBytes, iv)
    const decryptedBytes = aes.decrypt(ciphertextWithTag)

    return decoder.decode(decryptedBytes)
  }

  /**
   * Helper: encrypt JS object to JSON then AES-256-GCM
   */
  IrisCrypto.encryptVaultObject = function (obj, vaultKeyBytes) {
    return IrisCrypto.encryptVaultData(JSON.stringify(obj), vaultKeyBytes)
  }

  /**
   * Helper: decrypt AES-256-GCM to JSON string then parse
   */
  IrisCrypto.decryptVaultObject = function (encryptedPayload, vaultKeyBytes) {
    const json = IrisCrypto.decryptVaultData(encryptedPayload, vaultKeyBytes)
    return JSON.parse(json)
  }

  /**
   * Unbiased random password generator
   */
  IrisCrypto.generatePassword = function (options = {}) {
    const {
      length = 24,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
      avoidAmbiguous = true,
    } = options

    let upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let lower = "abcdefghijklmnopqrstuvwxyz"
    let num = "0123456789"
    let sym = "!@#$%^&*()-_=+[]{}|;:,.<>?"

    if (avoidAmbiguous) {
      upper = upper.replace(/[IO]/g, "")
      lower = lower.replace(/[lo]/g, "")
      num = num.replace(/[01]/g, "")
      sym = sym.replace(/[{}\[\]()\/\\'"`~,;:.<>]/g, "")
    }

    let charset = ""
    const requiredChars = []

    function getCryptoRandomInt(max) {
      if (max <= 0) return 0
      const buf = new Uint32Array(1)
      crypto.getRandomValues(buf)
      return buf[0] % max
    }

    if (uppercase && upper.length > 0) {
      charset += upper
      requiredChars.push(upper[getCryptoRandomInt(upper.length)])
    }
    if (lowercase && lower.length > 0) {
      charset += lower
      requiredChars.push(lower[getCryptoRandomInt(lower.length)])
    }
    if (numbers && num.length > 0) {
      charset += num
      requiredChars.push(num[getCryptoRandomInt(num.length)])
    }
    if (symbols && sym.length > 0) {
      charset += sym
      requiredChars.push(sym[getCryptoRandomInt(sym.length)])
    }

    if (!charset) charset = lower || "abcdefghijklmnopqrstuvwxyz"

    const targetLength = Math.max(8, Math.min(256, length))
    const randomBuffer = new Uint32Array(targetLength)
    crypto.getRandomValues(randomBuffer)

    const resultChars = []
    for (let i = 0; i < targetLength; i++) {
      const idx = randomBuffer[i] % charset.length
      resultChars.push(charset[idx])
    }

    // Guarantee required characters are included
    for (let i = 0; i < requiredChars.length; i++) {
      resultChars[i] = requiredChars[i]
    }

    // Shuffle in-place using Fisher-Yates with crypto random
    for (let i = resultChars.length - 1; i > 0; i--) {
      const rand = new Uint32Array(1)
      crypto.getRandomValues(rand)
      const j = rand[0] % (i + 1)
      const temp = resultChars[i]
      resultChars[i] = resultChars[j]
      resultChars[j] = temp
    }

    return resultChars.join("")
  }

  // Diceware Wordlist (subset of EFF large list)
  const DICEWARE_WORDS = [
    "acrobat",
    "activate",
    "adapt",
    "admit",
    "advance",
    "aerial",
    "affect",
    "agile",
    "airline",
    "album",
    "alchemy",
    "alert",
    "alibi",
    "altitude",
    "amplify",
    "anchor",
    "ancient",
    "android",
    "animate",
    "antenna",
    "antique",
    "apollo",
    "apparatus",
    "arcade",
    "archive",
    "arctic",
    "aroma",
    "arsenal",
    "artifact",
    "artisan",
    "aspect",
    "astral",
    "athlete",
    "atlas",
    "atomic",
    "atrium",
    "audio",
    "aurora",
    "avenue",
    "aviator",
    "backup",
    "badge",
    "balance",
    "balcony",
    "ballad",
    "bamboo",
    "banner",
    "baron",
    "barrier",
    "beacon",
    "beam",
    "bison",
    "blade",
    "blanket",
    "blaze",
    "blender",
    "blimp",
    "blizzard",
    "bluebird",
    "bold",
    "bonus",
    "border",
    "boulder",
    "bounce",
    "bracket",
    "breeze",
    "brick",
    "bridge",
    "brigade",
    "bronze",
    "buffer",
    "bulletin",
    "bundle",
    "bunker",
    "cactus",
    "cadence",
    "calcium",
    "caliber",
    "camera",
    "camper",
    "canal",
    "canvas",
    "canyon",
    "capsule",
    "captain",
    "caravan",
    "carbon",
    "cargo",
    "cascade",
    "castle",
    "cathedral",
    "cavalry",
    "cavern",
    "cedar",
    "celestial",
    "cement",
    "ceramic",
    "chalet",
    "champion",
    "channel",
    "chapter",
    "chariot",
    "charter",
    "chasm",
    "chimney",
    "chorus",
    "chrome",
    "chronicle",
    "cider",
    "cipher",
    "circuit",
    "circus",
    "citadel",
    "citizen",
    "citrus",
    "civic",
    "clarity",
    "classic",
    "cliff",
    "climate",
    "clover",
    "cobalt",
    "cockpit",
    "colony",
    "comet",
    "compass",
    "complex",
    "composer",
    "conduit",
    "conifer",
    "console",
    "conquest",
    "copper",
    "coral",
    "corridor",
    "cosmic",
    "counsel",
    "courage",
    "cradle",
    "craft",
    "crater",
    "crescent",
    "crest",
    "cricket",
    "crystal",
    "cube",
    "current",
    "cyclone",
    "dagger",
    "dawn",
    "daylight",
    "delta",
    "density",
    "deposit",
    "depot",
    "derby",
    "desert",
    "device",
    "diagonal",
    "diamond",
    "dignity",
    "diploma",
    "dirigible",
    "disc",
    "diver",
    "dock",
    "domain",
    "dome",
    "domino",
    "dragon",
    "dynamo",
    "eagle",
    "echo",
    "eclipse",
    "effigy",
    "element",
    "emerald",
    "emperor",
    "empire",
    "enclave",
    "engine",
    "entropy",
    "epic",
    "episode",
    "epoch",
    "equator",
    "essence",
    "ether",
    "everest",
    "expanse",
    "express",
    "fabric",
    "falcon",
    "feather",
    "federal",
    "felicity",
    "festival",
    "filament",
    "finch",
    "fjord",
    "flame",
    "flare",
    "fleet",
    "flint",
    "floral",
    "forest",
    "forge",
    "formula",
    "fortress",
    "fortune",
    "fossil",
    "founder",
    "fraction",
    "fragment",
    "frost",
    "furnace",
    "galaxy",
    "gallery",
    "gamut",
    "gargoyle",
    "garnet",
    "gateway",
    "gemini",
    "general",
    "generator",
    "genesis",
    "geode",
    "glacier",
    "glider",
    "glimmer",
    "glory",
    "goblet",
    "granite",
    "graph",
    "gravity",
    "grove",
    "guardian",
    "gulf",
    "habitat",
    "halcyon",
    "harbor",
    "harmony",
    "harvest",
    "haven",
    "hazard",
    "helix",
    "helmet",
    "herald",
    "heritage",
    "heroic",
    "hexagon",
    "highway",
    "horizon",
    "hummingbird",
    "hurricane",
    "hydra",
  ]

  /**
   * Diceware passphrase generator
   */
  IrisCrypto.generatePassphrase = function (options = {}) {
    const {
      wordCount = 4,
      separator = "-",
      capitalize = true,
      includeNumber = true,
    } = options

    const count = Math.max(3, Math.min(32, wordCount))
    const randWords = []
    const randomVals = new Uint32Array(count)
    crypto.getRandomValues(randomVals)

    for (let i = 0; i < count; i++) {
      let word = DICEWARE_WORDS[randomVals[i] % DICEWARE_WORDS.length]
      if (capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1)
      }
      randWords.push(word)
    }

    if (includeNumber) {
      const numRand = new Uint32Array(1)
      crypto.getRandomValues(numRand)
      const num = (numRand[0] % 90) + 10 // 10-99
      const insertIdx = numRand[0] % randWords.length
      randWords[insertIdx] = `${randWords[insertIdx]}${num}`
    }

    return randWords.join(separator)
  }

  /**
   * Calculate Shannon entropy in bits
   */
  IrisCrypto.calculateEntropy = function (password) {
    if (!password) return 0
    let pool = 0
    if (/[a-z]/.test(password)) pool += 26
    if (/[A-Z]/.test(password)) pool += 26
    if (/[0-9]/.test(password)) pool += 10
    if (/[^a-zA-Z0-9]/.test(password)) pool += 33
    if (pool === 0) pool = 1
    return Math.round(password.length * (Math.log(pool) / Math.LN2))
  }

  /**
   * Generates Ed25519 or RSA SSH keypair in-browser using WebCrypto
   */
  IrisCrypto.generateSshKeypair = async function (algorithm = "ED25519", comment = "user@iris") {
    function encodeSshString(data) {
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
      const len = bytes.length
      const res = new Uint8Array(4 + len)
      res[0] = (len >>> 24) & 0xff
      res[1] = (len >>> 16) & 0xff
      res[2] = (len >>> 8) & 0xff
      res[3] = len & 0xff
      res.set(bytes, 4)
      return res
    }

    function concatArrays(arrays) {
      const totalLen = arrays.reduce((acc, curr) => acc + curr.length, 0)
      const res = new Uint8Array(totalLen)
      let offset = 0
      for (const arr of arrays) {
        res.set(arr, offset)
        offset += arr.length
      }
      return res
    }

    function bytesToBase64(bytes) {
      let bin = ""
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
      return btoa(bin)
    }

    function arrayBufferToPem(buffer, label) {
      const b64 = bytesToBase64(new Uint8Array(buffer))
      const lines = b64.match(/.{1,64}/g) || []
      return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`
    }

    if (algorithm === "ED25519") {
      const keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])
      const rawPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey))
      const pkcs8PrivateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)

      const keyType = "ssh-ed25519"
      const openSshBlob = concatArrays([encodeSshString(keyType), encodeSshString(rawPublicKey)])
      const publicKeyOpenSsh = `${keyType} ${bytesToBase64(openSshBlob)} ${comment}`
      const privateKeyPem = arrayBufferToPem(pkcs8PrivateKey, "PRIVATE KEY")

      const hash = noble ? noble.sha256(openSshBlob) : new Uint8Array(await crypto.subtle.digest("SHA-256", openSshBlob))
      const fingerprintSha256 = `SHA256:${bytesToBase64(hash).replace(/=+$/, "")}`

      return {
        algorithm: "ED25519",
        publicKeyOpenSsh,
        privateKeyPem,
        fingerprintSha256,
      }
    } else {
      const modulusLength = algorithm === "RSA_4096" ? 4096 : 2048
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["sign", "verify"]
      )
      const spkiPublicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey)
      const pkcs8PrivateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)

      const publicKeyOpenSsh = arrayBufferToPem(spkiPublicKey, "PUBLIC KEY")
      const privateKeyPem = arrayBufferToPem(pkcs8PrivateKey, "RSA PRIVATE KEY")
      const hash = noble ? noble.sha256(new Uint8Array(spkiPublicKey)) : new Uint8Array(await crypto.subtle.digest("SHA-256", spkiPublicKey))
      const fingerprintSha256 = `SHA256:${bytesToBase64(hash).replace(/=+$/, "")}`

      return {
        algorithm,
        publicKeyOpenSsh,
        privateKeyPem,
        fingerprintSha256,
      }
    }
  }

  /**
   * Set up PIN unlock: derives key via scrypt and encrypts the 256-bit vault key
   */
  IrisCrypto.setupPinUnlock = function (pin, vaultKey) {
    if (!noble) throw new Error("Cryptographic module not loaded")
    if (!pin || pin.length < 4) throw new Error("PIN must be at least 4 characters")

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))

    const pinKey = noble.scrypt(pin.normalize("NFKC"), salt, {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 32,
    })

    const aes = noble.gcm(pinKey, iv)
    const ciphertextWithTag = aes.encrypt(vaultKey)
    const cipher = ciphertextWithTag.slice(0, -16)
    const authTag = ciphertextWithTag.slice(-16)

    return {
      saltHex: bytesToHex(salt),
      ivHex: bytesToHex(iv),
      authTagHex: bytesToHex(authTag),
      cipherHex: bytesToHex(cipher),
    }
  }

  /**
   * Unlocks vault key using PIN and saved PIN unlock data
   */
  IrisCrypto.unlockWithPin = function (pin, pinData) {
    if (!noble) throw new Error("Cryptographic module not loaded")
    if (!pinData?.saltHex || !pinData?.ivHex || !pinData?.authTagHex || !pinData?.cipherHex) {
      throw new Error("Invalid or missing PIN unlock data")
    }

    const salt = hexToBytes(pinData.saltHex)
    const iv = hexToBytes(pinData.ivHex)
    const authTag = hexToBytes(pinData.authTagHex)
    const cipher = hexToBytes(pinData.cipherHex)

    const pinKey = noble.scrypt(pin.normalize("NFKC"), salt, {
      N: 16384,
      r: 8,
      p: 1,
      dkLen: 32,
    })

    const ciphertextWithTag = new Uint8Array(cipher.length + authTag.length)
    ciphertextWithTag.set(cipher, 0)
    ciphertextWithTag.set(authTag, cipher.length)

    const aes = noble.gcm(pinKey, iv)
    try {
      return aes.decrypt(ciphertextWithTag)
    } catch (err) {
      throw new Error("Incorrect PIN")
    }
  }

  /**
   * Helper: Base64 encoding/decoding
   */
  IrisCrypto.bytesToBase64 = function (bytes) {
    let bin = ""
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }

  IrisCrypto.base64ToBytes = function (b64) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  }

  root.IrisCrypto = IrisCrypto
  if (typeof globalThis !== "undefined") {
    globalThis.IrisCrypto = IrisCrypto
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof globalThis !== "undefined"
      ? globalThis
      : this
)
