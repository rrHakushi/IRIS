export interface ApiKeyItem {
  id: string
  name: string
  prefix: string
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

export interface ExpirationOption {
  label: string
  days: number | null
}

export const EXPIRATION_OPTIONS: readonly ExpirationOption[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "Never", days: null },
] as const
