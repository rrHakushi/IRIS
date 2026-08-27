"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconFingerprint,
} from "@tabler/icons-react";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";

export type MfaType = "totp" | "email" | "passkey" | "backup_code";

interface LoginMfaProps {
  allowedTypes: MfaType[];
  activeType: MfaType;
  setActiveType: (type: MfaType) => void;
  mfaCode: string;
  setMfaCode: (code: string) => void;
  loading: boolean;
  errorMessage: string | null;
  emailCooldown: number;
  onSubmit: (e: React.FormEvent) => void;
  onSendEmailOtp: () => void;
  onRetryPasskey: () => void;
  onBack: () => void;
}

export function LoginMfa({
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
  const t = useTranslations("auth.login");

  return (
    <div className="flex flex-col justify-center">
      <FieldGroup className="gap-4 sm:gap-5">
        <div className="flex flex-col items-center gap-1.5 sm:gap-2 text-center pb-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {t("mfaVerification")}
          </h1>
          <p className="text-balance text-muted-foreground text-xs sm:text-sm">
            {t("mfaInstructions")}
          </p>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs font-medium text-destructive">
            <IconAlertCircle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {allowedTypes.length > 1 && (
          <div className="flex rounded-lg border border-border p-1 gap-1">
            {allowedTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setActiveType(type);
                  setMfaCode("");
                  if (type === "email") {
                    onSendEmailOtp();
                  }
                }}
                className={cn(
                  "flex-1 rounded py-1.5 text-xs font-medium transition-colors",
                  activeType === type
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {type === "totp"
                  ? t("authenticatorCode")
                  : type === "email"
                  ? t("emailCode")
                  : type === "passkey"
                  ? t("passkey")
                  : t("backupCode")}
              </button>
            ))}
          </div>
        )}

        {/* TOTP Entry */}
        {activeType === "totp" && (
          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              {t("enterOtpFromApp")}
            </p>
            <Field>
              <Input
                type="text"
                required
                maxLength={6}
                disabled={loading}
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="text-center font-mono text-xl sm:text-2xl tracking-widest h-11 sm:h-12"
                autoFocus
              />
            </Field>
            <Button
              type="submit"
              disabled={loading || mfaCode.length < 6}
              className="w-full h-10 sm:h-11 md:h-12 text-sm sm:text-base font-semibold"
            >
              {loading ? <Spinner className="size-4 mr-2" /> : null}
              {t("verify")}
            </Button>
          </form>
        )}

        {/* Email OTP Entry */}
        {activeType === "email" && (
          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              {t("otpSentToPrimaryEmail")}
            </p>
            <Field>
              <Input
                type="text"
                required
                maxLength={6}
                disabled={loading}
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="text-center font-mono text-xl sm:text-2xl tracking-widest h-11 sm:h-12"
                autoFocus
              />
            </Field>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {emailCooldown > 0 ? (
                <span>{t("resendInSeconds", { seconds: emailCooldown })}</span>
              ) : (
                <button
                  type="button"
                  onClick={onSendEmailOtp}
                  className="font-medium text-foreground hover:underline"
                >
                  {t("resendEmail")}
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || mfaCode.length < 6}
              className="w-full h-10 sm:h-11 md:h-12 text-sm sm:text-base font-semibold"
            >
              {loading ? <Spinner className="size-4 mr-2" /> : null}
              {t("verify")}
            </Button>
          </form>
        )}

        {/* Backup Recovery Code */}
        {activeType === "backup_code" && (
          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              {t("enterTenCharBackup")}
            </p>
            <Field>
              <Input
                type="text"
                required
                maxLength={10}
                disabled={loading}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.trim().toUpperCase())}
                placeholder="A1B2C3D4E5"
                className="text-center font-mono text-base sm:text-lg tracking-widest h-11 sm:h-12"
                autoFocus
              />
            </Field>
            <Button
              type="submit"
              disabled={loading || mfaCode.length < 8}
              className="w-full h-10 sm:h-11 md:h-12 text-sm sm:text-base font-semibold"
            >
              {loading ? <Spinner className="size-4 mr-2" /> : null}
              {t("submitRecoveryCode")}
            </Button>
          </form>
        )}

        {/* Passkey MFA Prompt */}
        {activeType === "passkey" && (
          <div className="flex flex-col items-center gap-3.5 text-center py-3">
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("browserRequestVerification")}
            </p>
            <Button
              type="button"
              disabled={loading}
              onClick={onRetryPasskey}
              className="w-full h-10 sm:h-11 md:h-12 text-sm sm:text-base font-semibold"
            >
              <IconFingerprint className="size-4 mr-2" />
              {t("retryPasskey")}
            </Button>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mt-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="size-3.5 sm:size-4 mr-1.5" />
          {t("backToCredentials")}
        </Button>
      </FieldGroup>
    </div>
  );
}
