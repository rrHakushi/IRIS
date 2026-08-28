"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconSend,
  IconCheck,
} from "@tabler/icons-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { FieldGroup } from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";

interface LoginQuickConnectProps {
  code: string | null;
  loading: boolean;
  errorMessage: string | null;
  initialIdentifier?: string;
  onSendNotification?: (userIdentifier: string) => Promise<void>;
  onBack: () => void;
}

export function LoginQuickConnect({
  code,
  loading,
  errorMessage,
  initialIdentifier = "",
  onSendNotification,
  onBack,
}: LoginQuickConnectProps) {
  const t = useTranslations("auth.login");
  const [userIdentifier, setUserIdentifier] = useState(initialIdentifier);
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [promptSuccess, setPromptSuccess] = useState(false);

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdentifier.trim() || !onSendNotification) return;

    setIsSendingPrompt(true);
    setPromptSuccess(false);
    try {
      await onSendNotification(userIdentifier.trim());
      setPromptSuccess(true);
    } finally {
      setIsSendingPrompt(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 sm:gap-6">
      <FieldGroup className="items-center text-center gap-3 sm:gap-4 w-full">
        <div className="flex flex-col items-center gap-1.5 sm:gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("loginWithCode")}
          </h1>
          <p className="text-balance text-muted-foreground text-xs sm:text-sm max-w-xs">
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
            <span className="text-xs sm:text-sm text-muted-foreground">
              {t("generatingCode")}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-border bg-muted/40 px-4 py-3 sm:px-6 sm:py-4 my-1 sm:my-2 w-full max-w-[280px] sm:max-w-xs">
            <span className="font-mono text-2xl sm:text-3xl font-bold tracking-widest text-foreground whitespace-nowrap select-all">
              {code}
            </span>
          </div>
        )}

        <span className="text-xs sm:text-sm text-muted-foreground">
          {t("waitingForAuth")}
        </span>

        {/* Send Prompt to Account Device */}
        {onSendNotification && (
          <form
            onSubmit={handleSendPrompt}
            className="w-full max-w-xs space-y-2 pt-2 border-t border-border/50"
          >
            <span className="text-[11px] font-semibold text-muted-foreground block text-left">
              {t("sendPromptToDevice")}
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                placeholder={t("sendPromptPlaceholder")}
                value={userIdentifier}
                onChange={(e) => {
                  setUserIdentifier(e.target.value);
                  setPromptSuccess(false);
                }}
                className="h-8 text-xs rounded-xl bg-background flex-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isSendingPrompt || !userIdentifier.trim()}
                className="h-8 text-xs rounded-xl px-2.5 gap-1 shrink-0"
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
              <span className="text-[11px] text-primary font-medium block text-left">
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
          className="mt-2 sm:mt-4 h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
        >
          <IconArrowLeft className="size-3.5 sm:size-4 mr-1.5" />
          {t("backToCredentials")}
        </Button>
      </FieldGroup>
    </div>
  );
}
