"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useUser } from "@/context/user-context";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Spinner } from "@workspace/ui/components/spinner";
import { PasswordCard } from "./security/password-card";
import { PasskeysCard } from "./security/passkeys-card";
import { Email2faCard } from "./security/email-2fa-card";
import { Totp2faCard } from "./security/totp-2fa-card";
import { QuickConnectCard } from "./security/quick-connect-card";
import { elysia } from "@/lib/elysia";
import { toast } from "sonner";
import type { SettingsTabProps } from "../types";

export function SecuritySettingsTab({
  setFooterContent,
}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.security");
  const { user, refetchUser } = useUser();

  // --- Password State ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // --- Email 2FA Draft State ---
  const originalEmailMfa = Boolean(user?.emailMfaEnabled);
  const [draftEmailMfa, setDraftEmailMfa] = useState(originalEmailMfa);

  // Sync draft state with user data on initial load / refresh
  useEffect(() => {
    if (user) {
      setDraftEmailMfa(Boolean(user.emailMfaEnabled));
    }
  }, [user?.emailMfaEnabled]);

  // Dirty State Check
  const isPasswordDirty = Boolean(currentPassword || newPassword || confirmPassword);
  const isEmailMfaDirty = draftEmailMfa !== originalEmailMfa;
  const isDirty = isPasswordDirty || isEmailMfaDirty;
  const [isSavingAll, setIsSavingAll] = useState(false);

  // Clear Password Form
  const handleClearPassword = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  // Submit Password Change Specifically
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    if (newPassword.length < 12 || newPassword.length > 64) {
      setPasswordError(t("passwordMinMaxError"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("passwordsDoNotMatch"));
      return;
    }

    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await elysia.auth.password.change.post(
        {
          currentPassword,
          newPassword,
        },
        {
          fetch: { credentials: "include" },
        }
      );

      if (res.error) {
        const errorData = res.error?.value as { message?: string } | undefined;
        const msg =
          errorData?.message ||
          t("incorrectCurrentPassword");
        throw new Error(msg);
      }

      setPasswordSuccess(t("passwordUpdated"));
      toast.success(t("passwordUpdated"));
      handleClearPassword();
    } catch (err: any) {
      console.error("[Security] Password update error:", err);
      setPasswordError(err.message || t("passwordUpdateFailed"));
      toast.error(err.message || t("passwordUpdateFailed"));
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Global Save All Handler for Unsaved Changes
  const handleSaveAll = async () => {
    if (!isDirty || isSavingAll) return;
    setIsSavingAll(true);

    try {
      // 1. Process password change if entered
      if (isPasswordDirty) {
        if (!currentPassword) {
          setPasswordError(t("currentPasswordRequired"));
          toast.error(t("enterCurrentPassword"));
          setIsSavingAll(false);
          return;
        }
        if (newPassword.length < 12 || newPassword.length > 64) {
          setPasswordError(t("passwordMinMaxError"));
          toast.error(t("passwordMustMeetRequirements"));
          setIsSavingAll(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setPasswordError(t("passwordsDoNotMatch"));
          toast.error(t("passwordsDoNotMatch"));
          setIsSavingAll(false);
          return;
        }

        const passRes = await elysia.auth.password.change.post(
          {
            currentPassword,
            newPassword,
          },
          {
            fetch: { credentials: "include" },
          }
        );

        if (passRes.error) {
          const errorData = passRes.error?.value as { message?: string } | undefined;
          const msg = errorData?.message || t("incorrectCurrentPasswordShort");
          throw new Error(msg);
        }

        handleClearPassword();
        toast.success(t("passwordUpdated"));
      }

      // 2. Process Email 2FA toggle if modified
      if (isEmailMfaDirty) {
        const emailRes = await elysia.auth.email.toggle.post(
          {
            enabled: draftEmailMfa,
          },
          {
            fetch: { credentials: "include" },
          }
        );

        if (emailRes.error) {
          const errorData = emailRes.error?.value as { message?: string } | undefined;
          const msg = errorData?.message || t("email2faUpdateFailed");
          throw new Error(msg);
        }

        toast.success(
          draftEmailMfa
            ? t("email2faEnabled")
            : t("email2faDisabled")
        );
      }

      await refetchUser();
    } catch (err: any) {
      console.error("[Security] Save error:", err);
      toast.error(err.message || t("failedSaveSecuritySettings"));
    } finally {
      setIsSavingAll(false);
    }
  };

  // Discard / Reset Handler
  const handleDiscard = () => {
    handleClearPassword();
    setDraftEmailMfa(originalEmailMfa);
    toast.info(t("changesDiscarded"));
  };

  // Push Sticky Actions to Settings Modal Footer
  useEffect(() => {
    if (!setFooterContent) return;

    setFooterContent(
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge
              variant="outline"
              className="text-xs border-amber-500/40 text-amber-400 bg-amber-500/10 animate-pulse"
            >
              {t("unsavedChanges")}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!isDirty || isSavingAll}
            onClick={handleDiscard}
            className="text-xs h-8 px-3"
          >
            {t("discard")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isDirty || isSavingAll}
            onClick={handleSaveAll}
            className="text-xs h-8 px-4 font-semibold"
          >
            {isSavingAll ? <Spinner className="size-3.5 mr-1.5" /> : null}
            {t("saveChanges")}
          </Button>
        </div>
      </div>
    );

    return () => setFooterContent(null);
  }, [isDirty, isSavingAll, currentPassword, newPassword, confirmPassword, draftEmailMfa, originalEmailMfa, t]);

  return (
    <div className="flex-1 w-full space-y-6 pb-6 animate-in fade-in-50 duration-200">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
      </div>

      {/* 1. Change Password */}
      <PasswordCard
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        isSaving={isSavingPassword || isSavingAll}
        errorMessage={passwordError}
        successMessage={passwordSuccess}
        onClear={handleClearPassword}
        onSubmit={handlePasswordSubmit}
      />

      {/* 2. Passkeys (Add & List) */}
      <PasskeysCard />

      {/* 3. Email 2FA */}
      <Email2faCard
        enabled={draftEmailMfa}
        originalEnabled={originalEmailMfa}
        email={user?.email || ""}
        onChange={setDraftEmailMfa}
        disabled={isSavingAll}
      />

      {/* 4. TOTP 2FA (Authenticator App) */}
      <Totp2faCard
        enabled={Boolean(user?.TOTPEnabled)}
        onRefresh={refetchUser}
        disabled={isSavingAll}
      />

      {/* 5. Quick Connect Device Pairing */}
      <QuickConnectCard />
    </div>
  );
}
