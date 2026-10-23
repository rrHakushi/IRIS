"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconLock,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
} from "@tabler/icons-react"
import { useEncryption } from "@/context/encryption-context"
import { toast } from "sonner"

export interface UnlockVaultDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function UnlockVaultDialog({
  isOpen,
  onClose,
}: UnlockVaultDialogProps): React.JSX.Element {
  const { unlockVault, isLoading } = useEncryption()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || submitting || isLoading) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await unlockVault(password)
      if (res.success) {
        toast.success("Encryption vault unlocked")
        setPassword("")
        setError(null)
        onClose()
      } else {
        setError(res.error || "Incorrect account password. Please try again.")
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to unlock encryption vault"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPassword("")
      setError(null)
      setShowPassword(false)
      onClose()
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      className="sm:max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-foreground">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <IconLock className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Unlock Encryption Vault
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter your account password to decrypt your zero-knowledge encryption keys.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
            <IconAlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="vault-password" className="text-xs font-medium">
            Account Password
          </FieldLabel>
          <div className="relative mt-1">
            <Input
              id="vault-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(null)
              }}
              suppressHydrationWarning
              autoFocus
              disabled={submitting || isLoading}
              className="h-10 pe-10 text-sm"
            />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <IconEyeOff className="size-4" />
              ) : (
                <IconEye className="size-4" />
              )}
            </button>
          </div>
        </Field>

        <DialogFooter className="gap-2 pt-1 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onPress={() => handleOpenChange(false)}
            isDisabled={submitting || isLoading}
            className="h-9 rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isDisabled={submitting || isLoading || !password.trim()}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
          >
            {submitting || isLoading ? <Spinner className="size-3.5" /> : null}
            Unlock Vault
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
