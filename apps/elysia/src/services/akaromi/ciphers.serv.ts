import { prisma, type PassCipherType, type PassRepromptType } from '@IRIS/database'
import { NotFound, BadRequest } from '../../lib/errors'

export interface ListCiphersFilter {
  type?: PassCipherType
  favorite?: boolean
  trash?: boolean
}

export interface CreateCipherDto {
  type: PassCipherType
  encryptedTitle: string
  encryptedData: string
  favorite?: boolean
  reprompt?: PassRepromptType
}

export interface UpdateCipherDto {
  type?: PassCipherType
  encryptedTitle?: string
  encryptedData?: string
  favorite?: boolean
  reprompt?: PassRepromptType
}

export class AkaromiCiphersServ {
  /**
   * Formats a PassCipher database entity into a client-safe response payload.
   */
  public static formatCipher(cipher: {
    id: string
    type: string
    favorite: boolean
    reprompt: string
    encryptedTitle: string
    encryptedData: string
    deletedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }) {
    return {
      id: cipher.id,
      type: cipher.type as 'LOGIN' | 'SSH_KEY',
      favorite: cipher.favorite,
      reprompt: cipher.reprompt as 'NONE' | 'REQUIRE_MASTER_PASSWORD',
      encryptedTitle: cipher.encryptedTitle,
      encryptedData: cipher.encryptedData,
      deletedAt: cipher.deletedAt ? cipher.deletedAt.toISOString() : null,
      createdAt: cipher.createdAt.toISOString(),
      updatedAt: cipher.updatedAt.toISOString(),
    }
  }

  /**
   * List vault ciphers with optional filtering by type, favorite, and trash status.
   */
  public static async listCiphers(userId: string, filter?: ListCiphersFilter) {
    const where: {
      userId: string
      deletedAt?: { not: null } | null
      type?: PassCipherType
      favorite?: boolean
    } = { userId }

    if (typeof filter?.trash === 'boolean') {
      if (filter.trash) {
        where.deletedAt = { not: null }
      } else {
        where.deletedAt = null
      }
    }

    if (filter?.type) {
      where.type = filter.type
    }

    if (typeof filter?.favorite === 'boolean') {
      where.favorite = filter.favorite
    }

    const ciphers = await prisma.passCipher.findMany({
      where,
      orderBy: [{ favorite: 'desc' }, { updatedAt: 'desc' }],
    })

    return {
      success: true,
      ciphers: ciphers.map((c) => this.formatCipher(c)),
    }
  }

  /**
   * Create a new cipher entry (login credentials or ssh key).
   */
  public static async createCipher(userId: string, data: CreateCipherDto) {
    if (!data.encryptedTitle || !data.encryptedTitle.trim()) {
      throw new BadRequest('Encrypted title is required and cannot be empty.')
    }
    if (!data.encryptedData || !data.encryptedData.trim()) {
      throw new BadRequest('Encrypted data payload is required and cannot be empty.')
    }

    const cipher = await prisma.passCipher.create({
      data: {
        userId,
        type: data.type,
        encryptedTitle: data.encryptedTitle,
        encryptedData: data.encryptedData,
        favorite: data.favorite ?? false,
        reprompt: data.reprompt ?? 'NONE',
      },
    })

    return {
      success: true,
      cipher: this.formatCipher(cipher),
      message: 'Cipher created successfully',
    }
  }

  /**
   * Retrieve a single cipher by ID.
   */
  public static async getCipher(userId: string, cipherId: string) {
    const cipher = await prisma.passCipher.findFirst({
      where: { id: cipherId, userId },
    })

    if (!cipher) {
      throw new NotFound('Cipher not found.')
    }

    return {
      success: true,
      cipher: this.formatCipher(cipher),
    }
  }

  /**
   * Update an existing cipher entry.
   * Strictly overwrites ciphertext - NEVER retains password history.
   */
  public static async updateCipher(
    userId: string,
    cipherId: string,
    data: UpdateCipherDto
  ) {
    const existing = await prisma.passCipher.findFirst({
      where: { id: cipherId, userId },
    })

    if (!existing) {
      throw new NotFound('Cipher not found.')
    }

    if (data.encryptedTitle !== undefined && !data.encryptedTitle.trim()) {
      throw new BadRequest('Encrypted title cannot be empty.')
    }
    if (data.encryptedData !== undefined && !data.encryptedData.trim()) {
      throw new BadRequest('Encrypted data payload cannot be empty.')
    }

    const updated = await prisma.passCipher.update({
      where: { id: cipherId },
      data: {
        type: data.type ?? existing.type,
        encryptedTitle: data.encryptedTitle ?? existing.encryptedTitle,
        encryptedData: data.encryptedData ?? existing.encryptedData,
        favorite: data.favorite !== undefined ? data.favorite : existing.favorite,
        reprompt: data.reprompt !== undefined ? data.reprompt : existing.reprompt,
      },
    })

    return {
      success: true,
      cipher: this.formatCipher(updated),
      message: 'Cipher updated successfully',
    }
  }

  /**
   * Delete a cipher by ID (moves to trash by default, or hard deletes when permanent=true).
   */
  public static async deleteCipher(
    userId: string,
    cipherId: string,
    permanent: boolean = false
  ) {
    const existing = await prisma.passCipher.findFirst({
      where: { id: cipherId, userId },
    })

    if (!existing) {
      throw new NotFound('Cipher not found.')
    }

    if (permanent) {
      await prisma.passCipher.delete({
        where: { id: cipherId },
      })
      return {
        success: true,
        id: cipherId,
        permanent: true,
        message: 'Cipher permanently deleted',
      }
    } else {
      await prisma.passCipher.update({
        where: { id: cipherId },
        data: { deletedAt: new Date() },
      })
      return {
        success: true,
        id: cipherId,
        permanent: false,
        message: 'Cipher moved to trash',
      }
    }
  }

  /**
   * Restore a cipher from trash bin.
   */
  public static async restoreCipher(userId: string, cipherId: string) {
    const existing = await prisma.passCipher.findFirst({
      where: { id: cipherId, userId },
    })

    if (!existing) {
      throw new NotFound('Cipher not found.')
    }

    await prisma.passCipher.update({
      where: { id: cipherId },
      data: { deletedAt: null },
    })

    return {
      success: true,
      id: cipherId,
      message: 'Cipher restored from trash',
    }
  }

  /**
   * Permanently purge all trashed ciphers for the user.
   */
  public static async emptyTrash(userId: string) {
    const result = await prisma.passCipher.deleteMany({
      where: {
        userId,
        deletedAt: { not: null },
      },
    })

    return {
      success: true,
      count: result.count,
      message: `Permanently deleted ${result.count} ciphers from trash`,
    }
  }
}
