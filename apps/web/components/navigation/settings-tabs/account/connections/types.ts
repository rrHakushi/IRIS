import type { ProviderMetadata } from "@IRIS/connections"

export interface UserConnectionItem {
  id: string
  provider: string
  authType: string
  externalId: string | null
  displayName: string | null
  avatarUrl: string | null
  profileUrl: string | null
  status: "CONNECTED" | "EXPIRED" | "REVOKED" | "ERROR" | "DISCONNECTED"
  errorMessage: string | null
  settings: {
    librarySync?: boolean
    isPrivate?: boolean
    hostUrl?: string
    [key: string]: unknown
  } | null
  lastSyncedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type { ProviderMetadata }
