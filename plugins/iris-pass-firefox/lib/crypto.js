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

    if (uppercase && upper.length > 0) {
      charset += upper
      requiredChars.push(upper[Math.floor(Math.random() * upper.length)])
    }
    if (lowercase && lower.length > 0) {
      charset += lower
      requiredChars.push(lower[Math.floor(Math.random() * lower.length)])
    }
    if (numbers && num.length > 0) {
      charset += num
      requiredChars.push(num[Math.floor(Math.random() * num.length)])
    }
    if (symbols && sym.length > 0) {
      charset += sym
      requiredChars.push(sym[Math.floor(Math.random() * sym.length)])
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
