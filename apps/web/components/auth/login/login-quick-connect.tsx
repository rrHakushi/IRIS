"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { IconAlertCircle, IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@workspace/ui/components/button";
import { FieldGroup } from "@workspace/ui/components/field";
import { Spinner } from "@workspace/ui/components/spinner";

interface LoginQuickConnectProps {
  code: string | null;
  loading: boolean;
  errorMessage: string | null;
  onBack: () => void;
}

export function LoginQuickConnect({
  code,
  loading,
  errorMessage,
  onBack,
}: LoginQuickConnectProps) {
  const t = useTranslations("auth.login");

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
