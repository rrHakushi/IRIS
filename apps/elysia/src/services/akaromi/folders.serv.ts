import { prisma } from '@IRIS/database'
import { NotFound, BadRequest } from '../../lib/errors'

export interface CreateFolderDto {
  encryptedName: string
  parentId?: string | null
}

export interface UpdateFolderDto {
  encryptedName?: string
  parentId?: string | null
}

export class AkaromiFoldersServ {
  /**
   * List all user vault folders with active (non-trashed) cipher counts.
   */
  public static async listFolders(userId: string) {
    const folders = await prisma.passFolder.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            ciphers: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return {
      success: true,
      folders: folders.map((f) => ({
        id: f.id,
        encryptedName: f.encryptedName,
        parentId: f.parentId,
        cipherCount: f._count.ciphers,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
      })),
    }
  }

  /**
   * Create a new vault folder.
   */
  public static async createFolder(userId: string, data: CreateFolderDto) {
    if (!data.encryptedName || !data.encryptedName.trim()) {
      throw new BadRequest('Encrypted folder name is required and cannot be empty.')
    }

    if (data.parentId) {
      const parent = await prisma.passFolder.findFirst({
        where: { id: data.parentId, userId },
      })
      if (!parent) {
        throw new NotFound('Parent folder not found.')
      }
    }

    const folder = await prisma.passFolder.create({
      data: {
        userId,
        encryptedName: data.encryptedName.trim(),
        parentId: data.parentId ?? null,
      },
    })

    return {
      success: true,
      folder: {
        id: folder.id,
        encryptedName: folder.encryptedName,
        parentId: folder.parentId,
        cipherCount: 0,
        createdAt: folder.createdAt.toISOString(),
        updatedAt: folder.updatedAt.toISOString(),
      },
      message: 'Folder created successfully',
    }
  }

  /**
   * Update an existing vault folder (name or hierarchical parent).
   */
  public static async updateFolder(
    userId: string,
    folderId: string,
    data: UpdateFolderDto
  ) {
    const existing = await prisma.passFolder.findFirst({
      where: { id: folderId, userId },
    })

    if (!existing) {
      throw new NotFound('Folder not found.')
    }

    if (data.parentId !== undefined && data.parentId !== null) {
      if (data.parentId === folderId) {
        throw new BadRequest('A folder cannot be its own parent.')
      }

      const parent = await prisma.passFolder.findFirst({
        where: { id: data.parentId, userId },
      })
      if (!parent) {
        throw new NotFound('Parent folder not found.')
      }
    }

    if (data.encryptedName !== undefined && !data.encryptedName.trim()) {
      throw new BadRequest('Encrypted folder name cannot be empty.')
    }

    const updated = await prisma.passFolder.update({
      where: { id: folderId },
      data: {
        encryptedName: data.encryptedName?.trim() ?? existing.encryptedName,
        parentId: data.parentId !== undefined ? data.parentId : existing.parentId,
      },
    })

    return {
      success: true,
      folder: {
        id: updated.id,
        encryptedName: updated.encryptedName,
        parentId: updated.parentId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      message: 'Folder updated successfully',
    }
  }

  /**
   * Delete a vault folder, unlinking all contained ciphers first.
   */
  public static async deleteFolder(userId: string, folderId: string) {
    const existing = await prisma.passFolder.findFirst({
      where: { id: folderId, userId },
    })

    if (!existing) {
      throw new NotFound('Folder not found.')
    }

    // 1. Unassign folderId from all contained ciphers
    await prisma.passCipher.updateMany({
      where: { folderId },
      data: { folderId: null },
    })

    // 2. Reparent or unlink any child folders if needed
    await prisma.passFolder.updateMany({
      where: { parentId: folderId },
      data: { parentId: existing.parentId ?? null },
    })

    // 3. Delete the folder
    await prisma.passFolder.delete({
      where: { id: folderId },
    })

    return {
      success: true,
      id: folderId,
      message: 'Folder deleted successfully',
    }
  }
}
