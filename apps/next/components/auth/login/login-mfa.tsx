"use client"

import React from "react"
import { useTranslations } from "next-intl"
import {
  IconAlertCircle,
  IconArrowLeft,
  IconFingerprint,
  IconKey,
  IconMail,
  IconSend,
  IconShieldCheck,
  IconShieldCode,
} from "@tabler/icons-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

export type MfaType = "totp" | "email" | "passkey" | "backup_code"

interface LoginMfaProps {
  identifier?: string
  allowedTypes: MfaType[]
  activeType: MfaType
  setActiveType: (type: MfaType) => void
  mfaCode: string
  setMfaCode: (code: string) => void
  loading: boolean
  errorMessage: string | null
  emailCooldown: number
  onSubmit: (e?: React.FormEvent, codeOverride?: string) => void
  onSendEmailOtp: () => void
  onRetryPasskey: () => void
  onBack: () => void
}

const MFA_META: Record<
  MfaType,
  {
    icon: React.ComponentType<{ className?: string }>
    labelKey: "authenticatorShort" | "emailShort" | "passkeyShort" | "backupShort"
  }
> = {
  totp: { icon: IconShieldCode, labelKey: "authenticatorShort" },
  email: { icon: IconMail, labelKey: "emailShort" },
  passkey: { icon: IconFingerprint, labelKey: "passkeyShort" },
  backup_code: { icon: IconKey, labelKey: "backupShort" },
}

export function LoginMfa({
  identifier,
  allowedTypes,
  activeType,
  setActiveType,
  mfaCode,
  setMfaCode,
  loading,
  errorMessage,
  emailCooldown,
  onSubmit,
  onSendEmailOtp,
  onRetryPasskey,
  onBack,
}: LoginMfaProps) {
  const t = useTranslations("auth.login")

  const handleOtpChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "").slice(0, 6)
    setMfaCode(cleaned)
    if (cleaned.length === 6 && !loading) {
      onSubmit(undefined, cleaned)
    }
  }

  return (
    <div className="flex flex-col justify-center gap-6">
      {/* Step Header */}
      <div className="flex flex-col items-start gap-2.5 text-start">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className="gap-1.5 rounded-full border border-border/70 bg-muted/70 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            <IconShieldCheck className="size-3.5 text-foreground/80" />
            <span>{t("stepTwoOfTwo")}</span>
          </Badge>
          {identifier && (
            <span className="truncate text-xs text-muted-foreground">
              {t("signingInAs", { identifier })}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {t("mfaVerification")}
          </h1>
          <p className="text-xs leading-relaxed text-balance text-muted-foreground sm:text-sm">
            {t("mfaInstructions")}
          </p>
        </div>
      </div>

      <FieldGroup className="gap-4">
        {errorMessage && (
          <Alert
            variant="destructive"
            className="rounded-xl border-destructive/40 bg-destructive/10 py-2.5 text-destructive"
          >
            <IconAlertCircle className="size-4" />
            <AlertDescription className="text-xs font-medium">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Method Selector */}
        {allowedTypes.length > 1 && (
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border/70 bg-muted/40 p-1 sm:flex">
            {allowedTypes.map((type) => {
              const meta = MFA_META[type]
              const Icon = meta.icon
              const isActive = activeType === type
              return (
                <button
                  key={type}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setActiveType(type)
                    setMfaCode("")
                    if (type === "email" && emailCooldown === 0) {
                      onSendEmailOtp()
                    }
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{t(meta.labelKey)}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* TOTP Entry */}
        {activeType === "totp" && (
          <form onSubmit={(e) => onSubmit(e)} className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t("enterOtpFromApp")}
            </p>
            <div className="flex justify-center py-1">
              <InputOTP
                maxLength={6}
                value={mfaCode}
                onChange={handleOtpChange}
                disabled={loading}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                  <InputOTPSlot index={1} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                  <InputOTPSlot index={2} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                  <InputOTPSlot index={4} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                  <InputOTPSlot index={5} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              type="submit"
              isDisabled={loading || mfaCode.length < 6}
              className="h-11 w-full rounded-xl text-sm font-semibold"
            >
              {loading ? <Spinner className="me-2 size-4" /> : null}
              {t("verify")}
            </Button>
          </form>
        )}

        {/* Email OTP Entry */}
        {activeType === "email" && (
          <form onSubmit={(e) => onSubmit(e)} className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t("otpSentToPrimaryEmail")}
            </p>
            <div className="flex justify-center py-1">
              <InputOTP
                maxLength={6}
                value={mfaCode}
                onChange={handleOtpChange}
                disabled={loading}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                  <InputOTPSlot index={1} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                  <InputOTPSlot index={2} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                  <InputOTPSlot index={4} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                  <InputOTPSlot index={5} className="size-11 text-base font-mono sm:size-12 sm:text-lg" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {emailCooldown > 0 ? (
                <span>{t("resendInSeconds", { seconds: emailCooldown })}</span>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={onSendEmailOtp}
                  className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
                >
                  <IconSend className="size-3.5" />
                  <span>{t("resendEmail")}</span>
                </button>
              )}
            </div>

            <Button
              type="submit"
              isDisabled={loading || mfaCode.length < 6}
              className="h-11 w-full rounded-xl text-sm font-semibold"
            >
              {loading ? <Spinner className="me-2 size-4" /> : null}
              {t("verify")}
            </Button>
          </form>
        )}

        {/* Passkey MFA */}
        {activeType === "passkey" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 p-5 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-background shadow-xs">
                <IconFingerprint className="size-6 text-foreground" />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {t("passkeyPromptHint")}
              </p>
            </div>
            <Button
              type="button"
              isDisabled={loading}
              onClick={onRetryPasskey}
              className="h-11 w-full gap-2 rounded-xl text-sm font-semibold"
            >
              {loading ? (
                <Spinner className="size-4" />
              ) : (
                <IconFingerprint className="size-4" />
              )}
              <span>{t("retryPasskey")}</span>
            </Button>
          </div>
        )}

        {/* Backup Recovery Code */}
        {activeType === "backup_code" && (
          <form onSubmit={(e) => onSubmit(e)} className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {t("enterTenCharBackup")}
            </p>
            <Field>
              <Input
                type="text"
                required
                maxLength={10}
                disabled={loading}
                suppressHydrationWarning
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.trim().toUpperCase())
                }
                placeholder="A1B2C3D4E5"
                className="h-12 rounded-xl text-center font-mono text-base tracking-[0.25em] sm:text-lg"
                autoFocus
              />
            </Field>
            <Button
              type="submit"
              isDisabled={loading || mfaCode.length < 8}
              className="h-11 w-full rounded-xl text-sm font-semibold"
            >
              {loading ? <Spinner className="me-2 size-4" /> : null}
              {t("submitRecoveryCode")}
            </Button>
          </form>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={onBack}
          className="h-9 w-fit gap-1.5 self-start px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-3.5" />
          <span>{t("backToCredentials")}</span>
        </Button>
      </FieldGroup>
    </div>
  )
}
