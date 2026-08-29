"use client";

import React, { useState, useEffect } from "react";
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
      setPasswordError("New password must be between 12 and 64 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
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
          "Incorrect current password or invalid request.";
        throw new Error(msg);
      }

      setPasswordSuccess("Password updated successfully.");
      toast.success("Password changed successfully!");
      handleClearPassword();
    } catch (err: any) {
      console.error("[Security] Password update error:", err);
      setPasswordError(err.message || "Failed to update password.");
      toast.error(err.message || "Failed to update password.");
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
          setPasswordError("Current password is required to change password.");
          toast.error("Please enter your current password.");
          setIsSavingAll(false);
          return;
        }
        if (newPassword.length < 12 || newPassword.length > 64) {
          setPasswordError("New password must be between 12 and 64 characters.");
          toast.error("New password must meet length requirements.");
          setIsSavingAll(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setPasswordError("Passwords do not match.");
          toast.error("Passwords do not match.");
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
          const msg = errorData?.message || "Incorrect current password.";
          throw new Error(msg);
        }

        handleClearPassword();
        toast.success("Password updated successfully!");
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
          const msg = errorData?.message || "Failed to update Email 2FA.";
          throw new Error(msg);
        }

        toast.success(
          draftEmailMfa
            ? "Email two-factor authentication enabled."
            : "Email two-factor authentication disabled."
        );
      }

      await refetchUser();
    } catch (err: any) {
      console.error("[Security] Save error:", err);
      toast.error(err.message || "Failed to save security settings.");
    } finally {
      setIsSavingAll(false);
    }
  };

  // Discard / Reset Handler
  const handleDiscard = () => {
    handleClearPassword();
    setDraftEmailMfa(originalEmailMfa);
    toast.info("Changes discarded.");
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
              Unsaved changes
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
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!isDirty || isSavingAll}
            onClick={handleSaveAll}
            className="text-xs h-8 px-4 font-semibold"
          >
            {isSavingAll ? <Spinner className="size-3.5 mr-1.5" /> : null}
            Save Changes
          </Button>
        </div>
      </div>
    );

    return () => setFooterContent(null);
  }, [isDirty, isSavingAll, currentPassword, newPassword, confirmPassword, draftEmailMfa, originalEmailMfa]);

  return (
    <div className="flex-1 w-full space-y-6 pb-6 animate-in fade-in-50 duration-200">
      <div>
        <h3 className="text-base font-bold text-foreground">Security</h3>
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
