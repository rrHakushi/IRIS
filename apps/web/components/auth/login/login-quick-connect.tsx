"use client"

import React, { useState } from "react"
import { useTranslations } from "next-intl"
import {
  IconAlertCircle,
  IconArrowLeft,
  IconSend,
  IconCheck,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { FieldGroup } from "@workspace/ui/components/field"
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
    <div className="flex flex-col items-center justify-center gap-4 text-center sm:gap-6">
      <FieldGroup className="w-full items-center gap-3 text-center sm:gap-4">
        <div className="flex flex-col items-center gap-1.5 sm:gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("loginWithCode")}
          </h1>
          <p className="max-w-xs text-xs text-balance text-muted-foreground sm:text-sm">
            {t("toLogInOpenSettings")}
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
            <IconAlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-6 sm:py-8">
            <Spinner className="size-8" />
            <span className="text-xs text-muted-foreground sm:text-sm">
              {t("generatingCode")}
            </span>
          </div>
        ) : (
          <div className="my-1 flex w-full max-w-[280px] items-center justify-center rounded-xl border border-border bg-muted/40 px-4 py-3 sm:my-2 sm:max-w-xs sm:px-6 sm:py-4">
            <span className="font-mono text-2xl font-bold tracking-widest whitespace-nowrap text-foreground select-all sm:text-3xl">
              {code}
            </span>
          </div>
        )}

        <span className="text-xs text-muted-foreground sm:text-sm">
          {t("waitingForAuth")}
        </span>

        {/* Send Prompt to Account Device */}
        {onSendNotification && (
          <form
            onSubmit={handleSendPrompt}
            className="w-full max-w-xs space-y-2 border-t border-border/50 pt-2"
          >
            <span className="block text-left text-[11px] font-semibold text-muted-foreground">
              {t("sendPromptToDevice")}
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                placeholder={t("sendPromptPlaceholder")}
                value={userIdentifier}
                onChange={(e) => {
                  setUserIdentifier(e.target.value)
                  setPromptSuccess(false)
                }}
                className="h-8 flex-1 rounded-xl bg-background text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSendingPrompt || !userIdentifier.trim()}
                className="h-8 shrink-0 gap-1 rounded-xl px-2.5 text-xs"
              >
                {isSendingPrompt ? (
                  <Spinner className="size-3.5" />
                ) : promptSuccess ? (
                  <IconCheck className="size-3.5 text-primary" />
                ) : (
                  <IconSend className="size-3.5" />
                )}
                <span>{t("sendPromptButton")}</span>
              </Button>
            </div>
            {promptSuccess && (
              <span className="block text-left text-[11px] font-medium text-primary">
                {t("promptSent")}
              </span>
            )}
          </form>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          className="mt-2 h-9 px-3 text-xs sm:mt-4 sm:h-10 sm:px-4 sm:text-sm"
        >
          <IconArrowLeft className="mr-1.5 size-3.5 sm:size-4" />
          {t("backToCredentials")}
        </Button>
      </FieldGroup>
    </div>
  )
}
