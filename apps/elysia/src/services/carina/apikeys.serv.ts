import { randomBytes } from 'node:crypto'
import { prisma } from '@IRIS/database'
import { hashApiKey } from '../../utils/auth-crypto'
import { BadRequest, NotFound } from '../../lib/errors'
import type { CarinaApiKeysModel } from '../../api/models/carina/apikeys.model'

function serializeApiKey(k: {
  id: string
  name: string
  prefix: string
  createdAt: Date
  updatedAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
}) {
  return {
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
  }
}

export abstract class CarinaApiKeysServ {
  /**
   * List API keys for the authenticated user with pagination (10 per page default).
   */
  static async listKeys(
    userId: string,
    query: { page?: number; limit?: number } = {}
  ) {
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10))
    const skip = (page - 1) * limit

    const [total, keys] = await Promise.all([
      prisma.apiKey.count({
        where: { userId },
      }),
      prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return {
      success: true,
      total,
      page,
      limit,
      apiKeys: keys.map(serializeApiKey),
    }
  }

  /**
   * Create a new API key for the user.
   * Generates a 24-byte entropy key (`iris-key-...`), stores SHA-256 hash, and returns raw token once.
   */
  static async createKey(
    userId: string,
    body: CarinaApiKeysModel['createBody']
  ) {
    const rawName = (body.name || '').trim()
    if (!rawName) {
      throw new BadRequest('API key name cannot be empty or contain only whitespace.')
    }

    const entropy = randomBytes(24).toString('hex')
    const rawKey = `iris-key-${entropy}`
    const prefix = rawKey.slice(0, 17)
    const hash = hashApiKey(rawKey)

    let expiresAt: Date | null = null
    if (typeof body.expirationDays === 'number' && body.expirationDays > 0) {
      expiresAt = new Date(
        Date.now() + body.expirationDays * 24 * 60 * 60 * 1000
      )
    }

    const created = await prisma.apiKey.create({
      data: {
        userId,
        name: rawName.slice(0, 64),
        prefix,
        hash,
        expiresAt,
      },
    })

    return {
      success: true,
      rawKey,
      apiKey: serializeApiKey(created),
    }
  }

  /**
   * Update display name of an existing API key.
   */
  static async updateKey(
    userId: string,
    keyId: string,
    body: CarinaApiKeysModel['updateBody']
  ) {
    const rawName = (body.name || '').trim()
    if (!rawName) {
      throw new BadRequest('API key name cannot be empty or contain only whitespace.')
    }

    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    })

    if (!existing) {
      throw new NotFound(`API key with ID '${keyId}' was not found.`)
    }

    const updated = await prisma.apiKey.update({
      where: { id: existing.id },
      data: { name: rawName.slice(0, 64) },
    })

    return {
      success: true,
      apiKey: serializeApiKey(updated),
    }
  }

  /**
   * Delete an existing API key.
   */
  static async deleteKey(userId: string, keyId: string) {
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    })

    if (!existing) {
      throw new NotFound(`API key with ID '${keyId}' was not found.`)
    }

    await prisma.apiKey.delete({
      where: { id: existing.id },
    })

    return {
      success: true,
      message: `API key '${keyId}' was deleted successfully.`,
    }
  }

  /**
   * Regenerate an API key token.
   * Generates a new secret, updates database hash and prefix, resets lastUsedAt.
   */
  static async regenerateKey(userId: string, keyId: string) {
    const existing = await prisma.apiKey.findFirst({
      where: { id: keyId, userId },
    })

    if (!existing) {
      throw new NotFound(`API key with ID '${keyId}' was not found.`)
    }

    const entropy = randomBytes(24).toString('hex')
    const rawKey = `iris-key-${entropy}`
    const prefix = rawKey.slice(0, 17)
    const hash = hashApiKey(rawKey)

    const updated = await prisma.apiKey.update({
      where: { id: existing.id },
      data: {
        hash,
        prefix,
        lastUsedAt: null,
      },
    })

    return {
      success: true,
      rawKey,
      apiKey: serializeApiKey(updated),
    }
  }
}
