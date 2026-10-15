import { prisma, type PassCipherType } from '@IRIS/database'
import { AkaromiCiphersServ } from './ciphers.serv'

export interface ImportCipherItem {
  type: PassCipherType
  encryptedTitle: string
  encryptedData: string
  favorite?: boolean
}

export interface ImportVaultBody {
  ciphers: ImportCipherItem[]
}

export class AkaromiVaultServ {
  /**
   * Synchronizes full or incremental vault state for the authenticated user.
   */
  public static async syncVault(userId: string, since?: string) {
    const now = new Date()
    const sinceDate = since ? new Date(since) : null
    const hasValidSince = sinceDate !== null && !isNaN(sinceDate.getTime())

    // 1. Fetch ciphers (modified or created since timestamp)
    const cipherWhere: { userId: string; updatedAt?: { gte: Date } } = { userId }
    if (hasValidSince) {
      cipherWhere.updatedAt = { gte: sinceDate }
    }

    const rawCiphers = await prisma.passCipher.findMany({
      where: cipherWhere,
      orderBy: { updatedAt: 'desc' },
    })

    // 2. Extract IDs of ciphers currently in trash or soft deleted
    const deletedCipherIds = rawCiphers
      .filter((c) => c.deletedAt !== null)
      .map((c) => c.id)

    return {
      success: true,
      serverTime: now.toISOString(),
      ciphers: rawCiphers.map((c) => AkaromiCiphersServ.formatCipher(c)),
      deletedCipherIds,
    }
  }

  /**
   * Exports full non-deleted vault data for backup or client migration.
   */
  public static async exportVault(userId: string) {
    const ciphers = await prisma.passCipher.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        type: true,
        favorite: true,
        encryptedTitle: true,
        encryptedData: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return {
      success: true,
      exportedAt: new Date().toISOString(),
      ciphers: ciphers.map((c) => ({
        id: c.id,
        type: c.type as 'LOGIN' | 'SSH_KEY',
        favorite: c.favorite,
        encryptedTitle: c.encryptedTitle,
        encryptedData: c.encryptedData,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    }
  }

  /**
   * Imports ciphers into the vault.
   */
  public static async importVault(userId: string, body: ImportVaultBody) {
    let importedCiphersCount = 0
    for (const cipherItem of body.ciphers) {
      if (cipherItem.encryptedTitle?.trim() && cipherItem.encryptedData?.trim()) {
        await prisma.passCipher.create({
          data: {
            userId,
            type: cipherItem.type,
            encryptedTitle: cipherItem.encryptedTitle,
            encryptedData: cipherItem.encryptedData,
            favorite: cipherItem.favorite ?? false,
          },
        })
        importedCiphersCount++
      }
    }

    return {
      success: true,
      importedCiphersCount,
      message: `Successfully imported ${importedCiphersCount} ciphers`,
    }
  }
}
