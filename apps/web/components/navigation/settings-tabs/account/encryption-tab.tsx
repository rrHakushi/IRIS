"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconAlertTriangle,
  IconCheck,
} from "@tabler/icons-react"
import { useEncryption } from "@/context/encryption-context"
import type { SettingsTabProps } from "../types"

export function EncryptionSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.encryption")
  const {
    isActive,
    isLoading,
    unlockVault,
    lockVault,
  } = useEncryption()

  // Unlock state
  const [unlockPassword, setUnlockPassword] = useState("")
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unlockPassword) return
    setUnlockError(null)
    const res = await unlockVault(unlockPassword)
    if (res.success) {
      setUnlockPassword("")
    } else {
      setUnlockError(t("incorrectPassword"))
    }
  }

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      {/* Section 1: Enter Password to Decrypt */}
      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {isActive ? t("encryptionUnlocked") : t("decryptData")}
          </span>
          {isActive && (
            <Button
              variant="outline"
              size="sm"
              onPress={lockVault}
              className="h-8 gap-1.5 rounded-xl border-destructive/30 text-xs text-destructive hover:bg-destructive/10"
            >
              <IconLock className="size-3.5" />
              <span>{t("lock")}</span>
            </Button>
          )}
        </div>

        {!isActive ? (
          <form onSubmit={handleUnlock} className="space-y-3">
            {unlockError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <IconAlertTriangle className="size-4 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  type={showUnlockPassword ? "text" : "password"}
                  required
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder={t("enterPasswordPlaceholder")}
                  className="h-10 rounded-xl pe-10 text-xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={
                    showUnlockPassword ? t("hidePassword") : t("showPassword")
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowUnlockPassword((prev) => !prev)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showUnlockPassword ? (
                    <IconEyeOff className="size-3.5" />
                  ) : (
                    <IconEye className="size-3.5" />
                  )}
                </button>
              </div>
              <Button
                type="submit"
                isDisabled={isLoading || !unlockPassword}
                className="h-10 shrink-0 rounded-xl px-5 text-xs font-semibold"
              >
                {isLoading ? (
                  <Spinner className="size-4" />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <IconLockOpen className="size-4" />
                    <span>{t("decrypt")}</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <IconCheck className="size-4" />
            <span>{t("activeForSession")}</span>
          </div>
        )}
      </div>

      {/* Section 2: Unified Cryptography Information */}
      <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            Zero-Knowledge Cryptography
          </span>
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
            Post-Quantum ML-KEM-768
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your vault is protected using zero-knowledge post-quantum cryptography (ML-KEM-768) derived directly from your primary account password. Device-bound persistent storage securely preserves your unlocked session across browser restarts until explicit sign out.
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          To update your encryption key, change your account password in the{" "}
          <strong className="text-foreground">Security &gt; Password</strong> tab.
        </p>
      </div>
    </div>
  )
}
