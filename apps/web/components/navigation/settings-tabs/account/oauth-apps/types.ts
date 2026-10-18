export interface OAuthAppItem {
  id: string
  clientId: string
  name: string
  description?: string | null
  logoUrl?: string | null
  websiteUrl?: string | null
  redirectUris: string[]
  isPublic: boolean
  isTrusted: boolean
  createdAt: string
  updatedAt?: string
  authorizedUsersCount?: number
  activeTokensCount?: number
}

export interface CreateOAuthAppPayload {
  name: string
  description?: string
  websiteUrl?: string
  logoUrl?: string
  redirectUris: string[]
  isPublic: boolean
}

export interface EditOAuthAppPayload {
  name?: string
  description?: string | null
  websiteUrl?: string | null
  logoUrl?: string | null
  redirectUris?: string[]
  isPublic?: boolean
}
