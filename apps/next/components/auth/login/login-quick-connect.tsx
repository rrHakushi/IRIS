"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconSend,
} from "@tabler/icons-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { FieldGroup } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

interface LoginQuickConnectProps {
  code: string | null
  loading: boolean
  errorMessage: string | null
  initialIdentifier?: string
  onSendNotification?: (userIdentifier: string) => Promise<void>
  onBack: () => void
}

export function LoginQuickConnect({
  code,
  loading,
  errorMessage,
  initialIdentifier = "",
  onSendNotification,
  onBack,
}: LoginQuickConnectProps) {
  const t = useTranslations("auth.login")
  const [userIdentifier, setUserIdentifier] = useState(initialIdentifier)
  const [isSendingPrompt, setIsSendingPrompt] = useState(false)
  const [promptSuccess, setPromptSuccess] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable
    }
  }

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userIdentifier.trim() || !onSendNotification) return

    setIsSendingPrompt(true)
    setPromptSuccess(false)
    try {
      await onSendNotification(userIdentifier.trim())
      setPromptSuccess(true)
    } finally {
      setIsSendingPrompt(false)
    }
  }

  return (
    <div className="flex flex-col justify-center gap-6">
      <div className="flex flex-col items-start gap-1 text-start">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("loginWithCode")}
        </h1>
        <p className="text-xs leading-relaxed text-balance text-muted-foreground sm:text-sm">
          {t("toLogInOpenSettings")}
        </p>
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

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 py-8">
            <Spinner className="size-7" />
            <span className="text-xs text-muted-foreground">
              {t("generatingCode")}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/40 px-5 py-4">
            <span className="font-mono text-2xl font-bold tracking-[0.22em] text-foreground select-all sm:text-3xl">
              {code}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              disabled={!code}
              className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs"
            >
              {copied ? (
                <IconCheck className="size-3.5 text-emerald-500" />
              ) : (
                <IconCopy className="size-3.5" />
              )}
              <span>{copied ? t("copied") : t("copyCode")}</span>
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <span>{t("waitingForAuth")}</span>
        </div>

        {/* Send Prompt to Account Device */}
        {onSendNotification && (
          <form
            onSubmit={handleSendPrompt}
            className="space-y-2 border-t border-border/50 pt-4"
          >
            <span className="block text-start text-xs font-medium text-muted-foreground">
              {t("sendPromptToDevice")}
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder={t("sendPromptPlaceholder")}
                value={userIdentifier}
                suppressHydrationWarning
                onChange={(e) => {
                  setUserIdentifier(e.target.value)
                  setPromptSuccess(false)
                }}
                className="h-10 flex-1 rounded-xl text-xs sm:text-sm"
              />
              <Button
                type="submit"
                size="sm"
                isDisabled={isSendingPrompt || !userIdentifier.trim()}
                className="h-10 shrink-0 gap-1.5 rounded-xl px-3.5 text-xs font-medium"
              >
                {isSendingPrompt ? (
                  <Spinner className="size-3.5" />
                ) : promptSuccess ? (
                  <IconCheck className="size-3.5" />
                ) : (
                  <IconSend className="size-3.5" />
                )}
                <span>{t("sendPromptButton")}</span>
              </Button>
            </div>
            {promptSuccess && (
              <span className="block text-start text-xs font-medium text-emerald-500">
                {t("promptSent")}
              </span>
            )}
          </form>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
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
