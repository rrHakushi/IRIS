export type PassCipherType = "LOGIN" | "SSH_KEY"
export type PassRepromptType = "NONE" | "REQUIRE_MASTER_PASSWORD"
export type SshAlgorithm = "ED25519" | "RSA_2048" | "RSA_4096"

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
  username: string
  password: string
  additionalPasswords?: AdditionalPassword[]
  uris: LoginUri[]
  totpSecret?: string
  passkey?: PasskeyData
  notes?: string
  customFields?: CustomField[]
}

/**
 * Decrypted in-memory payload for an SSH_KEY cipher.
 */
export interface DecryptedSshKeyData {
  keyType: SshAlgorithm
  publicKey: string
  privateKey: string
  passphrase?: string
  fingerprint: string
  notes?: string
}

export interface DecryptedCipher {
  id: string
  type: PassCipherType
  title: string
  favorite: boolean
  reprompt: PassRepromptType
  folderId: string | null
  data: DecryptedLoginData | DecryptedSshKeyData
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DecryptedFolder {
  id: string
  name: string
  parentId: string | null
  cipherCount: number
  createdAt: string
  updatedAt: string
}
