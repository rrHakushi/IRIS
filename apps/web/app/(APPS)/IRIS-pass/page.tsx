"use client"

import React, { useState, useEffect, Suspense } from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { usePass } from "@/context/pass-context"
import { useEncryption } from "@/context/encryption-context"
import { PassCipherList } from "./components/pass-cipher-list"
import { PassCipherDetail } from "./components/pass-cipher-detail"
import { PassCipherModal } from "./components/pass-cipher-modal"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import {
  IconLock,
  IconLockOpen,
  IconKey,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconPlus,
  IconFolderPlus,
  IconShieldLock,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"

function PassMainContent() {
  const searchParams = useSearchParams()
  const {
    isUnlocked,
    isLoading,
    activeFilter,
    setActiveFilter,
    folders,
    ciphers,
    lockVault,
    unlockVault,
    refreshData,
    createFolder,
    emptyTrash,
    selectedCipherId,
    setSelectedCipherId,
  } = usePass()

  const encryption = useEncryption()

  // Sync activeFilter with URL searchParams
  useEffect(() => {
    const filterParam = searchParams.get("filter")
    const folderParam = searchParams.get("folder")
    if (folderParam) {
      setActiveFilter(folderParam)
    } else if (filterParam) {
      setActiveFilter(filterParam)
    } else {
      setActiveFilter("all")
    }
  }, [searchParams, setActiveFilter])

  // Mount check to guarantee hydration safety
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [editCipherId, setEditCipherId] = useState<string | null>(null)
  const [folderModalOpen, setFolderModalOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  // Unlock state
  const [unlockPassword, setUnlockPassword] = useState("")
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unlockPassword.trim()) return

    setIsUnlocking(true)
    setUnlockError(null)

    const result = await unlockVault(unlockPassword)
    setIsUnlocking(false)

    if (result.success) {
      setUnlockPassword("")
      toast.success("Vault unlocked successfully")
    } else {
      setUnlockError(
        result.error ||
          (encryption.hasSeparateEncryptionPassword
            ? "Incorrect decryption password. Please try again."
            : "Incorrect account password. Please try again.")
      )
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!folderName.trim()) return

    setIsCreatingFolder(true)
    const newFolder = await createFolder(folderName.trim())
    setIsCreatingFolder(false)

    if (newFolder) {
      setFolderName("")
      setFolderModalOpen(false)
      toast.success(`Folder "${newFolder.name}" created`)
    }
  }

  // Pre-hydration placeholder to match server and client render
  if (!isMounted) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-10 animate-pulse items-center justify-center rounded-2xl bg-[#d800a6]/10">
            <Image
              src="/iris-pass512left-ring.png"
              alt="IRIS Pass"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <span className="animate-pulse text-xs text-muted-foreground">
            Loading vault...
          </span>
        </div>
      </div>
    )
  }

  // If vault is locked, render the standard inline unlock screen reusing existing encryption
  if (!isUnlocked) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center bg-background/50 p-6 backdrop-blur-xs">
        <div className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-8 shadow-2xl">
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[#d800a6]/10 shadow-inner ring-1 ring-[#d800a6]/20">
              <Image
                src="/iris-pass512left-ring.png"
                alt="IRIS Pass"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div className="space-y-1">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                IRIS Pass Vault Locked
              </h1>
              <p className="max-w-sm text-xs text-muted-foreground">
                {encryption.hasSeparateEncryptionPassword
                  ? "Enter your dedicated IRIS decryption password to decrypt your zero-knowledge vault."
                  : "Enter your IRIS account password to decrypt and unlock your zero-knowledge vault."}
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            {unlockError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <IconAlertCircle className="size-4 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label
                htmlFor="pass-unlock-input"
                className="text-xs font-medium text-foreground"
              >
                {encryption.hasSeparateEncryptionPassword
                  ? "Decryption Password"
                  : "Account Password"}
              </Label>
              <div className="relative">
                <Input
                  id="pass-unlock-input"
                  type={showUnlockPassword ? "text" : "password"}
                  placeholder="Enter password to unlock..."
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  autoFocus
                  className="h-10 rounded-xl pe-10 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                  aria-label={
                    showUnlockPassword ? "Hide password" : "Show password"
                  }
                >
                  {showUnlockPassword ? (
                    <IconEyeOff className="size-4" />
                  ) : (
                    <IconEye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isUnlocking || !unlockPassword.trim()}
              className="h-10 w-full cursor-pointer rounded-xl bg-rose-500 text-xs font-semibold text-white shadow-md transition-all hover:bg-rose-600"
            >
              <IconLockOpen className="me-2 size-4" />
              {isUnlocking ? "Decrypting Vault..." : "Unlock Vault"}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // Current folder name if filtering by folder
  const currentFolder = folders.find((f) => f.id === activeFilter)
  const filterLabel = currentFolder
    ? currentFolder.name
    : activeFilter === "favorites"
      ? "Favorites"
      : activeFilter === "logins"
        ? "Logins"
        : activeFilter === "ssh"
          ? "SSH Keys"
          : activeFilter === "trash"
            ? "Trash"
            : "All Vault Items"

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Top Action Bar */}
      <header className="flex h-14 shrink-0 items-center justify-end border-b border-border/80 bg-card/40 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshData()}
            className="h-8 gap-1.5 rounded-xl text-xs"
            aria-label="Refresh vault"
          >
            <IconRefresh className="size-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {activeFilter === "trash" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (
                  confirm(
                    "Are you sure you want to permanently delete all items in the trash?"
                  )
                ) {
                  await emptyTrash()
                }
              }}
              disabled={
                ciphers.filter((c) => c.deletedAt !== null).length === 0
              }
              className="h-8 cursor-pointer gap-1.5 rounded-xl text-xs shadow-xs"
            >
              <IconTrash className="size-3.5" />
              <span>Empty Trash</span>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFolderModalOpen(true)}
                className="h-8 gap-1.5 rounded-xl text-xs"
                aria-label="Create new folder"
              >
                <IconFolderPlus className="size-3.5" />
                <span className="hidden sm:inline">New Folder</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setEditCipherId(null)
                  setModalOpen(true)
                }}
                className="h-8 gap-1.5 rounded-xl bg-rose-500 text-xs text-white shadow-xs hover:bg-rose-600"
              >
                <IconPlus className="size-3.5" />
                <span>New Item</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              lockVault()
              toast.info("Vault locked")
            }}
            className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            aria-label="Lock vault"
          >
            <IconLock className="size-3.5" />
            <span className="hidden sm:inline">Lock</span>
          </Button>
        </div>
      </header>

      {/* Main Dual-Pane Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left/Middle Column: List of items */}
        <div className="flex h-full w-full shrink-0 flex-col overflow-hidden border-e border-border sm:w-80 md:w-96 lg:w-[420px]">
          <PassCipherList
            onOpenNewCipher={() => {
              setEditCipherId(null)
              setModalOpen(true)
            }}
          />
        </div>

        {/* Right Column: Item detail inspector pane */}
        <div className="hidden h-full flex-1 overflow-y-auto bg-card/20 sm:flex">
          <PassCipherDetail
            onEditCipher={(id) => {
              setEditCipherId(id)
              setModalOpen(true)
            }}
          />
        </div>
      </div>

      {/* Create / Edit Cipher Modal */}
      <PassCipherModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editCipherId={editCipherId}
      />

      {/* Create Folder Modal */}
      <Dialog
        isOpen={folderModalOpen}
        onOpenChange={setFolderModalOpen}
        className="sm:max-w-md"
      >
        <DialogHeader className="text-start">
          <DialogTitle className="text-base font-bold text-foreground">
            Create Folder
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="folder-name-input"
              className="text-xs font-medium text-foreground"
            >
              Folder Name
            </Label>
            <Input
              id="folder-name-input"
              type="text"
              placeholder="e.g. Work, Personal, Servers..."
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
              className="h-9 rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFolderModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreatingFolder || !folderName.trim()}
              className="rounded-xl bg-rose-500 text-xs text-white hover:bg-rose-600"
            >
              {isCreatingFolder ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  )
}

export default function PassPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Image
              src="/iris-pass512left-ring.png"
              alt="IRIS Pass"
              width={16}
              height={16}
              className="animate-pulse object-contain"
            />
            <span>Loading IRIS Pass...</span>
          </div>
        </div>
      }
    >
      <PassMainContent />
    </Suspense>
  )
}
