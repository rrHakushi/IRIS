"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Switch } from "@workspace/ui/components/switch";
import { Badge } from "@workspace/ui/components/badge";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog";
import {
  IconShieldCheck,
  IconQrcode,
  IconCopy,
  IconCheck,
  IconDownload,
  IconAlertTriangle,
  IconKey,
  IconEye,
  IconEyeOff,
  IconDeviceMobile,
  IconLock,
} from "@tabler/icons-react";
import { elysia } from "@/lib/elysia";
import { toast } from "sonner";

export interface Totp2faCardProps {
  enabled: boolean;
  onRefresh: () => Promise<unknown> | void;
  disabled?: boolean;
}

export function Totp2faCard({
  enabled,
  onRefresh,
  disabled = false,
}: Totp2faCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.security");

  // Modal states
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  // Setup state
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Backup codes state (returned on first activation)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  // Disable state
  const [disableMethod, setDisableMethod] = useState<"code" | "password">("code");
  const [disableCode, setDisableCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Start Setup Flow
  const handleStartSetup = async () => {
    setSetupOpen(true);
    setIsSettingUp(true);
    setSetupError(null);
    setVerificationCode("");
    setBackupCodes(null);
    setCopiedSecret(false);
    setCopiedBackupCodes(false);
    setShowSecret(false);

    try {
      const res = await elysia.auth.totp.setup.post(
        {},
        { fetch: { credentials: "include" } }
      );
      if (res.error || !res.data) {
        const errorData = res.error?.value as { message?: string } | undefined;
        const msg = errorData?.message || t("failedInitiateSetup");
        throw new Error(msg);
      }

      setQrCodeDataUrl(res.data.qrCodeDataUrl);
      setSecretKey(res.data.secret);
    } catch (err: any) {
      console.error("[TOTP] Setup error:", err);
      setSetupError(err.message || t("failedLoadSetup"));
    } finally {
      setIsSettingUp(false);
    }
  };

  // Open Disable Modal & Reset State
  const handleOpenDisable = () => {
    setDisableOpen(true);
    setDisableMethod("code");
    setDisableCode("");
    setDisablePassword("");
    setShowDisablePassword(false);
    setDisableError(null);
  };

  // Verify and Activate TOTP
  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim() || verificationCode.trim().length !== 6) {
      setSetupError(t("validSixDigitError"));
      return;
    }

    setIsVerifying(true);
    setSetupError(null);

    try {
      const res = await elysia.auth.totp.toggle.post(
        {
          enabled: true,
          code: verificationCode.trim(),
          secret: secretKey || undefined,
        },
        {
          fetch: { credentials: "include" },
        }
      );

      if (res.error) {
        const errorData = res.error?.value as { message?: string } | undefined;
        const msg =
          errorData?.message ||
          t("invalidVerificationCode");
        throw new Error(msg);
      }

      toast.success(t("authenticatorActivatedSuccess"));
      await onRefresh();

      if (res.data?.backupCodes && res.data.backupCodes.length > 0) {
        setBackupCodes(res.data.backupCodes);
      } else {
        setSetupOpen(false);
      }
    } catch (err: any) {
      console.error("[TOTP] Verification error:", err);
      setSetupError(err.message || t("failedVerifyCode"));
    } finally {
      setIsVerifying(false);
    }
  };

  // Copy Secret Key
  const handleCopySecret = async () => {
    if (!secretKey) return;
    try {
      await navigator.clipboard.writeText(secretKey);
      setCopiedSecret(true);
      toast.success(t("secretCopied"));
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      toast.error(t("failedCopySecret"));
    }
  };

  // Copy All Backup Codes
  const handleCopyBackupCodes = async () => {
    if (!backupCodes || backupCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedBackupCodes(true);
      toast.success(t("backupCodesCopied"));
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    } catch {
      toast.error(t("failedCopyBackupCodes"));
    }
  };

  // Download Backup Codes as Text File
  const handleDownloadBackupCodes = () => {
    if (!backupCodes || backupCodes.length === 0) return;
    const content = `IRIS Account Backup Recovery Codes\nGenerated: ${new Date().toISOString()}\n\nKeep these codes in a safe place. Each code can be used once to access your account if you lose access to your authenticator app:\n\n${backupCodes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `IRIS-backup-codes-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("backupCodesDownloaded"));
  };

  // Disable TOTP Handler
  const handleDisableTotp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (disableMethod === "code" && (!disableCode.trim() || disableCode.trim().length !== 6)) {
      setDisableError(t("enterSixDigitToDisable"));
      return;
    }
    if (disableMethod === "password" && !disablePassword.trim()) {
      setDisableError(t("enterPasswordToDisable"));
      return;
    }

    setIsDisabling(true);
    setDisableError(null);

    try {
      const res = await elysia.auth.totp.toggle.post(
        {
          enabled: false,
          code: disableMethod === "code" ? disableCode.trim() : undefined,
          password: disableMethod === "password" ? disablePassword.trim() : undefined,
        },
        {
          fetch: { credentials: "include" },
        }
      );

      if (res.error) {
        const errorData = res.error?.value as { message?: string } | undefined;
        const msg = errorData?.message || t("failedDisableTotp");
        throw new Error(msg);
      }

      toast.success(t("authenticatorDisabledSuccess"));
      setDisableOpen(false);
      setDisableCode("");
      setDisablePassword("");
      await onRefresh();
    } catch (err: any) {
      console.error("[TOTP] Disable error:", err);
      setDisableError(err.message || t("failedDisableTotp"));
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <IconShieldCheck className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm text-foreground">
                  {t("authenticator")}
                </h4>
                {enabled ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4.5 px-2 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-semibold"
                  >
                    {t("active")}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4.5 px-2 text-muted-foreground border-border font-medium"
                  >
                    {t("inactive")}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Switch
            isSelected={enabled}
            onChange={(selected) => {
              if (selected) {
                handleStartSetup();
              } else {
                handleOpenDisable();
              }
            }}
            isDisabled={disabled}
            aria-label={t("toggleTotpAria")}
          />
        </div>

        <div className="rounded-xl border border-border/50 bg-background/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {enabled
              ? t("totpActiveDesc")
              : t("totpInactiveDesc")}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => (enabled ? handleOpenDisable() : handleStartSetup())}
            className="h-7 text-xs rounded-lg px-3 self-start sm:self-auto shrink-0"
          >
            {enabled ? t("manageDisable") : t("configureApp")}
          </Button>
        </div>
      </div>

      {/* TOTP Setup Dialog */}
      <Dialog isOpen={setupOpen} onOpenChange={setSetupOpen}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <IconQrcode className="size-5" />
            <DialogTitle>
              {backupCodes ? t("emergencyRecoveryCodes") : t("setUpAuthenticatorApp")}
            </DialogTitle>
          </div>
          {backupCodes && (
            <DialogDescription>
              {t("emergencyRecoveryDesc")}
            </DialogDescription>
          )}
        </DialogHeader>

        {backupCodes ? (
          /* Step 2: Backup Codes View */
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2.5 text-xs text-amber-300">
              <IconAlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>
                {t("codesShownOnceWarning")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-border bg-muted/40 font-mono text-xs text-foreground">
              {backupCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-background/80 border border-border/50"
                >
                  <span className="text-muted-foreground text-[11px] select-none">
                    {idx + 1}.
                  </span>
                  <span className="font-semibold select-all">{code}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyBackupCodes}
                  className="h-8 text-xs rounded-xl gap-1.5"
                >
                  {copiedBackupCodes ? (
                    <IconCheck className="size-3.5 text-primary" />
                  ) : (
                    <IconCopy className="size-3.5" />
                  )}
                  <span>{copiedBackupCodes ? t("copied") : t("copyAll")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadBackupCodes}
                  className="h-8 text-xs rounded-xl gap-1.5"
                >
                  <IconDownload className="size-3.5" />
                  <span>{t("downloadTxt")}</span>
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => setSetupOpen(false)}
                className="h-8 text-xs font-semibold rounded-xl px-4"
              >
                {t("done")}
              </Button>
            </div>
          </div>
        ) : (
          /* Step 1: QR Code & Verification Form */
          <form onSubmit={handleVerifySetup} className="space-y-4 pt-1">
            {setupError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <IconAlertTriangle className="size-4 shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            {isSettingUp ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Spinner className="size-6" />
                <span className="text-xs text-muted-foreground">
                  {t("generatingKey")}
                </span>
              </div>
            ) : (
              <>
                {qrCodeDataUrl && (
                  <div className="flex flex-col items-center justify-center gap-3 py-2">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrCodeDataUrl}
                        alt="TOTP QR Code"
                        className="size-48 rounded-lg"
                      />
                    </div>

                    {secretKey && (
                      <div className="flex items-center gap-2 max-w-full">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-muted/60 text-xs font-mono">
                          <IconKey className="size-3.5 text-muted-foreground shrink-0" />
                          <span className={showSecret ? "select-all font-semibold" : "tracking-widest select-none text-muted-foreground"}>
                            {showSecret ? secretKey : "••••••••••••••••"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setShowSecret((prev) => !prev)}
                          className="size-8 rounded-xl shrink-0"
                          aria-label={showSecret ? t("hideSecretAria") : t("showSecretAria")}
                        >
                          {showSecret ? (
                            <IconEyeOff className="size-3.5" />
                          ) : (
                            <IconEye className="size-3.5" />
                          )}
                        </Button>
                        {showSecret && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={handleCopySecret}
                            className="size-8 rounded-xl shrink-0 animate-in fade-in-50"
                            aria-label={t("copySecretAria")}
                          >
                            {copiedSecret ? (
                              <IconCheck className="size-3.5 text-primary" />
                            ) : (
                              <IconCopy className="size-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {t("enter6DigitCode")}
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) =>
                      setVerificationCode(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="123456"
                    className="h-10 text-center font-mono text-base tracking-widest rounded-xl"
                    autoFocus
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSetupOpen(false)}
                    className="h-8 text-xs"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isVerifying || verificationCode.length !== 6}
                    className="h-8 text-xs font-semibold rounded-xl px-4 gap-1.5"
                  >
                    {isVerifying ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <IconCheck className="size-3.5" />
                    )}
                    <span>{t("verifyAndActivate")}</span>
                  </Button>
                </DialogFooter>
              </>
            )}
          </form>
        )}
      </Dialog>

      {/* Disable TOTP Confirmation Dialog (Accepts Authenticator Code or Password) */}
      <Dialog isOpen={disableOpen} onOpenChange={setDisableOpen}>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <IconAlertTriangle className="size-5" />
            <DialogTitle>{t("disableAuthenticatorTitle")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("disableAuthenticatorDesc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDisableTotp} className="space-y-4 pt-1">
          {disableError && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <IconAlertTriangle className="size-4 shrink-0" />
              <span>{disableError}</span>
            </div>
          )}

          {/* Verification Method Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => {
                setDisableMethod("code");
                setDisableError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-all ${
                disableMethod === "code"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconDeviceMobile className="size-3.5" />
              <span>{t("authenticatorCode")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDisableMethod("password");
                setDisableError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-all ${
                disableMethod === "password"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconLock className="size-3.5" />
              <span>{t("password")}</span>
            </button>
          </div>

          {disableMethod === "code" ? (
            <div className="space-y-1.5 animate-in fade-in-50 duration-150">
              <label className="text-xs font-medium text-foreground">
                {t("sixDigitCode")}
              </label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={disableCode}
                onChange={(e) => {
                  setDisableError(null);
                  setDisableCode(e.target.value.replace(/\D/g, ""));
                }}
                placeholder="123456"
                className="h-10 text-center font-mono text-base tracking-widest rounded-xl bg-background"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-1.5 animate-in fade-in-50 duration-150">
              <label className="text-xs font-medium text-foreground">
                {t("accountPassword")}
              </label>
              <div className="relative">
                <Input
                  type={showDisablePassword ? "text" : "password"}
                  value={disablePassword}
                  onChange={(e) => {
                    setDisableError(null);
                    setDisablePassword(e.target.value);
                  }}
                  placeholder={t("enterAccountPasswordPlaceholder")}
                  className="h-10 text-xs pe-10 rounded-xl bg-background"
                  autoFocus
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowDisablePassword((prev) => !prev)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={showDisablePassword ? t("hidePassword") : t("showPassword")}
                >
                  {showDisablePassword ? (
                    <IconEyeOff className="size-3.5" />
                  ) : (
                    <IconEye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDisableOpen(false)}
              className="h-8 text-xs"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={
                isDisabling ||
                (disableMethod === "code" && disableCode.trim().length !== 6) ||
                (disableMethod === "password" && !disablePassword.trim())
              }
              className="h-8 text-xs font-semibold rounded-xl px-4 gap-1.5 cursor-pointer"
            >
              {isDisabling ? <Spinner className="size-3.5" /> : null}
              <span>{t("confirmAndDisable")}</span>
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
