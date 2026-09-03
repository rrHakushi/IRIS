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
import {
  PasswordChecklist,
  type PasswordCriteria,
  type PasswordRule,
} from "@/components/auth/register/password-checklist"
import { useEncryption } from "@/context/encryption-context"
import type { SettingsTabProps } from "../types"

export function EncryptionSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.encryption")
  const {
    isActive,
    hasSeparateEncryptionPassword,
    isLoading,
    unlockVault,
    lockVault,
    changeEncryptionPassword,
  } = useEncryption()

  // Unlock state
  const [unlockPassword, setUnlockPassword] = useState("")
  const [showUnlockPassword, setShowUnlockPassword] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null)

  // Encryption password criteria: min 16 chars, max 64, 1 uppercase, 2 numbers, 2 special chars
  const criteria: PasswordCriteria = {
    length: newPassword.length >= 16,
    maxLength: newPassword.length > 0 && newPassword.length <= 64,
    uppercase: /[A-Z]/.test(newPassword),
    number: /(?:.*[0-9]){2}/.test(newPassword),
    special: /(?:.*[!@#$%^&*(),.?":{}|<>~'_\-+=/\\\[\]\x60]){2}/.test(
      newPassword
    ),
  }

  const isPasswordValid = Object.values(criteria).every(Boolean)
  const strengthScore = Object.values(criteria).filter(Boolean).length

  const encryptionRules: readonly PasswordRule[] = [
    { key: "length", label: t("rules.minLen") },
    { key: "maxLength", label: t("rules.maxLen") },
    { key: "uppercase", label: t("rules.upper") },
    { key: "number", label: t("rules.number") },
    { key: "special", label: t("rules.special") },
  ]

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!unlockPassword) return
    setUnlockError(null)
    const res = await unlockVault(unlockPassword)
    if (res.success) {
      setUnlockPassword("")
    } else {
      setUnlockError(
        hasSeparateEncryptionPassword
          ? t("incorrectEncryptionPasswordSeparate")
          : t("incorrectPassword")
      )
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeError(null)
    setChangeSuccess(null)

    if (!currentPassword) {
      setChangeError(t("currentPasswordRequired"))
      return
    }
    if (!isPasswordValid) {
      setChangeError(t("complexityRequirements"))
      return
    }
    if (newPassword !== confirmPassword) {
      setChangeError(t("passwordsDoNotMatch"))
      return
    }

    const res = await changeEncryptionPassword(currentPassword, newPassword)
    if (res.success) {
      setChangeSuccess(t("encryptionPasswordUpdated"))
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setIsNewPasswordFocused(false)
    } else {
      setChangeError(res.error || t("failedUpdateEncryptionPassword"))
    }
  }

  const handleClearFields = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setChangeError(null)
    setChangeSuccess(null)
    setIsNewPasswordFocused(false)
  }

  const hasInput = Boolean(currentPassword || newPassword || confirmPassword)

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
      </div>

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
                  placeholder={
                    hasSeparateEncryptionPassword
                      ? t("enterEncryptionPasswordPlaceholder")
                      : t("enterPasswordPlaceholder")
                  }
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
                disabled={isLoading || !unlockPassword}
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

      {/* Section 2: Create / Change Encryption Password */}
      <form onSubmit={handleChangePassword} className="space-y-4">
        <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">
              {hasSeparateEncryptionPassword
                ? t("changeEncryptionPassword")
                : t("createSeparateEncryptionPassword")}
            </span>
            {hasSeparateEncryptionPassword && (
              <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                {t("enabled")}
              </span>
            )}
          </div>

          {changeError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <IconAlertTriangle className="size-4 shrink-0" />
              <span>{changeError}</span>
            </div>
          )}

          {changeSuccess && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
              <IconCheck className="size-4 shrink-0" />
              <span>{changeSuccess}</span>
            </div>
          )}

          <div className="space-y-4 pt-1">
            <div className="relative">
              <Input
                type={showCurrentPassword ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={
                  hasSeparateEncryptionPassword
                    ? t("currentEncryptionPasswordPlaceholder")
                    : t("currentAccountPasswordPlaceholder")
                }
                className="h-10 rounded-xl pe-10 text-xs"
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={
                  showCurrentPassword ? t("hidePassword") : t("showPassword")
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? (
                  <IconEyeOff className="size-3.5" />
                ) : (
                  <IconEye className="size-3.5" />
                )}
              </button>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={16}
                  maxLength={64}
                  value={newPassword}
                  onFocus={() => setIsNewPasswordFocused(true)}
                  onBlur={() => setIsNewPasswordFocused(false)}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("newEncryptionPasswordPlaceholder")}
                  className="h-10 rounded-xl pe-10 text-xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={
                    showNewPassword ? t("hidePassword") : t("showPassword")
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? (
                    <IconEyeOff className="size-3.5" />
                  ) : (
                    <IconEye className="size-3.5" />
                  )}
                </button>
              </div>

              {/* Password Visualizer Checklist - only shown when field is active/focused */}
              {isNewPasswordFocused && (
                <PasswordChecklist
                  criteria={criteria}
                  strengthScore={strengthScore}
                  rules={encryptionRules}
                />
              )}
            </div>

            <Input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirmNewEncryptionPasswordPlaceholder")}
              className="h-10 rounded-xl text-xs"
            />
          </div>
        </div>

        {/* Action bar - only shown when fields have input */}
        {hasInput && (
          <div className="flex animate-in items-center justify-end gap-3 rounded-2xl border border-border/60 bg-muted/20 px-5 py-3.5 duration-200 fade-in-50">
            <button
              type="button"
              onClick={handleClearFields}
              className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("clearFields")}
            </button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !isPasswordValid ||
                !currentPassword ||
                newPassword !== confirmPassword
              }
              className="h-10 rounded-xl px-5 text-xs font-semibold"
            >
              {isLoading ? <Spinner className="size-4" /> : t("updatePassword")}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
