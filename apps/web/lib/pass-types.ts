export type PassCipherType = "LOGIN" | "SSH_KEY"
export type AkaromiSubtype =
  | "login"
  | "note"
  | "card"
  | "ssh"
  | "identity"
  | "other"

export type PassRepromptType = "NONE" | "REQUIRE_MASTER_PASSWORD"
export type SshAlgorithm = "ED25519" | "RSA_2048" | "RSA_4096"

export type PassSortOption =
  | "title_asc"
  | "title_desc"
  | "updated"
  | "created_desc"
  | "created_asc"
  | "recent_used"

export type BitwardenUriMatch =
  | "BASE_DOMAIN"
  | "HOST"
  | "STARTS_WITH"
  | "EXACT"
  | "REGULAR_EXPRESSION"
  | "NEVER"

export interface LoginUri {
  uri: string
  match?: BitwardenUriMatch
}

export interface PasskeyData {
  credentialId: string
  rpId: string
  userHandle?: string
  userName?: string
  counter?: number
  createdAt?: string
}

export interface AdditionalPassword {
  id: string
  name: string
  value: string
}

export interface CustomField {
  name: string
  value: string
  isHidden?: boolean
}

/**
 * Decrypted in-memory payload for a LOGIN cipher.
 * Strictly guarantees ZERO password history retention.
 */
export interface DecryptedLoginData {
  itemType?: "login"
  username: string
  email?: string
  password: string
  additionalPasswords?: AdditionalPassword[]
  uris: LoginUri[]
  totpSecret?: string
  passkey?: PasskeyData
  notes?: string
  customFields?: CustomField[]
}

/**
 * Decrypted in-memory payload for a NOTE cipher.
 */
export interface DecryptedNoteData {
  itemType?: "note"
  notes: string
}

/**
 * Decrypted in-memory payload for a CREDIT CARD cipher.
 */
export interface DecryptedCardData {
  itemType?: "card"
  cardHolder: string
  cardNumber: string
  cardExp: string
  cardCvv: string
  cardPin?: string
  notes?: string
}

/**
 * Decrypted in-memory payload for an SSH_KEY cipher.
 */
export interface DecryptedSshKeyData {
  itemType?: "ssh"
  keyType: SshAlgorithm
  publicKey: string
  privateKey: string
  passphrase?: string
  fingerprint: string
  notes?: string
}

/**
 * Decrypted in-memory payload for an IDENTITY cipher.
 */
export interface DecryptedIdentityData {
  itemType?: "identity"
  fullName: string
  email: string
  phone: string
  address: string
  company?: string
  notes?: string
}

/**
 * Decrypted in-memory payload for an OTHER / CUSTOM FIELDS cipher.
 */
export interface DecryptedOtherData {
  itemType?: "other"
  customFields: CustomField[]
  notes?: string
}

export type DecryptedCipherData =
  | DecryptedLoginData
  | DecryptedNoteData
  | DecryptedCardData
  | DecryptedSshKeyData
  | DecryptedIdentityData
  | DecryptedOtherData

export interface DecryptedCipher {
  id: string
  type: PassCipherType
  title: string
  favorite: boolean
  reprompt: PassRepromptType
  folderId: string | null
  data: DecryptedCipherData
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}


export interface PinUnlockData {
  saltHex: string
  ivHex: string
  authTagHex: string
  cipherHex: string
}

