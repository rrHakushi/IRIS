import { prisma, type PassCipherType } from '@IRIS/database'
import { AkaromiCiphersServ } from './ciphers.serv'

export interface ImportFolderItem {
  tempId: string
  encryptedName: string
}

export interface ImportCipherItem {
  type: PassCipherType
  encryptedTitle: string
  encryptedData: string
  folderTempId?: string | null
  favorite?: boolean
}

export interface ImportVaultBody {
  folders: ImportFolderItem[]
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

    // 2. Fetch folders (modified or created since timestamp)
    const folderWhere: { userId: string; updatedAt?: { gte: Date } } = { userId }
    if (hasValidSince) {
      folderWhere.updatedAt = { gte: sinceDate }
    }

    const rawFolders = await prisma.passFolder.findMany({
      where: folderWhere,
      orderBy: { updatedAt: 'desc' },
    })

    // 3. Extract IDs of ciphers currently in trash or soft deleted
    const deletedCipherIds = rawCiphers
      .filter((c) => c.deletedAt !== null)
      .map((c) => c.id)

    return {
      success: true,
      serverTime: now.toISOString(),
      ciphers: rawCiphers.map((c) => AkaromiCiphersServ.formatCipher(c)),
      deletedCipherIds,
      folders: rawFolders.map((f) => ({
        id: f.id,
        encryptedName: f.encryptedName,
        parentId: f.parentId,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    }
  }

  /**
   * Exports full non-deleted vault data for backup or client migration.
   */
  public static async exportVault(userId: string) {
    const folders = await prisma.passFolder.findMany({
      where: { userId },
      select: {
        id: true,
        encryptedName: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const ciphers = await prisma.passCipher.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        type: true,
        favorite: true,
        folderId: true,
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
      folders,
      ciphers: ciphers.map((c) => ({
        id: c.id,
        type: c.type as 'LOGIN' | 'SSH_KEY',
        favorite: c.favorite,
        folderId: c.folderId,
        encryptedTitle: c.encryptedTitle,
        encryptedData: c.encryptedData,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    }
  }

  /**
   * Imports folders and ciphers into the vault, mapping client temp IDs to persisted database IDs.
   */
  public static async importVault(userId: string, body: ImportVaultBody) {
    const folderMap = new Map<string, string>()

    // 1. Create folders and map client temp IDs to database IDs
    for (const folderItem of body.folders) {
      if (folderItem.encryptedName?.trim()) {
        const created = await prisma.passFolder.create({
          data: {
            userId,
            encryptedName: folderItem.encryptedName.trim(),
          },
        })
        folderMap.set(folderItem.tempId, created.id)
      }
    }

    // 2. Create ciphers with remapped folder IDs
    let importedCiphersCount = 0
    for (const cipherItem of body.ciphers) {
      if (cipherItem.encryptedTitle?.trim() && cipherItem.encryptedData?.trim()) {
        const mappedFolderId = cipherItem.folderTempId
          ? (folderMap.get(cipherItem.folderTempId) ?? null)
          : null

        await prisma.passCipher.create({
          data: {
            userId,
            type: cipherItem.type,
            encryptedTitle: cipherItem.encryptedTitle,
            encryptedData: cipherItem.encryptedData,
            folderId: mappedFolderId,
            favorite: cipherItem.favorite ?? false,
          },
        })
        importedCiphersCount++
      }
    }

    return {
      success: true,
      importedFoldersCount: folderMap.size,
      importedCiphersCount,
      message: `Successfully imported ${folderMap.size} folders and ${importedCiphersCount} ciphers`,
    }
  }
}
