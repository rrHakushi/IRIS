"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  IconLock,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import {
  PasswordChecklist,
  type PasswordCriteria,
} from "@/components/auth/register/password-checklist";
import { cn } from "@workspace/ui/lib/utils";

export interface PasswordCardProps {
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  isSaving: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  onClear: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export function PasswordCard({
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  isSaving,
  errorMessage,
  successMessage,
  onClear,
  onSubmit,
}: PasswordCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.security");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isNewPasswordFocused, setIsNewPasswordFocused] = useState(false);

  // Criteria matching backend validation (min 12, max 64, upper, num, special)
  const criteria: PasswordCriteria = {
    length: newPassword.length >= 12,
    maxLength: newPassword.length > 0 && newPassword.length <= 64,
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>~'_\-+=/\\\[\]\x60]/.test(newPassword),
  };

  const isPasswordValid = Object.values(criteria).every(Boolean);
  const strengthScore = Object.values(criteria).filter(Boolean).length;
  const isMatch = Boolean(confirmPassword && newPassword === confirmPassword);
  const hasInput = Boolean(currentPassword || newPassword || confirmPassword);

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <IconLock className="size-4" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">{t("changePassword")}</h4>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
          <IconAlertTriangle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-in fade-in-50">
          <IconCheck className="size-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="space-y-3 pt-1">
        {/* Current Password Field */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">
            {t("currentPassword")}
          </label>
          <div className="relative">
            <Input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t("enterCurrentPasswordPlaceholder")}
              className="h-10 text-xs pe-10 rounded-xl bg-background/70"
            />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label={showCurrentPassword ? t("hidePassword") : t("showPassword")}
            >
              {showCurrentPassword ? (
                <IconEyeOff className="size-3.5" />
              ) : (
                <IconEye className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* New Password Field */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">
            {t("newPassword")}
          </label>
          <div className="relative">
            <Input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onFocus={() => setIsNewPasswordFocused(true)}
              onBlur={() => setIsNewPasswordFocused(false)}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("enterNewPasswordPlaceholder")}
              className="h-10 text-xs pe-10 rounded-xl bg-background/70"
            />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label={showNewPassword ? t("hidePassword") : t("showPassword")}
            >
              {showNewPassword ? (
                <IconEyeOff className="size-3.5" />
              ) : (
                <IconEye className="size-3.5" />
              )}
            </button>
          </div>

          {/* Password Visualizer Checklist */}
          {(isNewPasswordFocused || (newPassword.length > 0 && !isPasswordValid)) && (
            <div className="animate-in fade-in-50 duration-150 pt-1">
              <PasswordChecklist
                criteria={criteria}
                strengthScore={strengthScore}
              />
            </div>
          )}
        </div>

        {/* Confirm New Password Field */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">
            {t("confirmNewPassword")}
          </label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("reenterNewPasswordPlaceholder")}
              className={cn(
                "h-10 text-xs pe-10 rounded-xl bg-background/70",
                confirmPassword && !isMatch && "border-destructive focus-visible:border-destructive"
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label={showConfirmPassword ? t("hidePassword") : t("showPassword")}
            >
              {showConfirmPassword ? (
                <IconEyeOff className="size-3.5" />
              ) : (
                <IconEye className="size-3.5" />
              )}
            </button>
          </div>
          {confirmPassword && !isMatch && (
            <p className="text-[11px] text-destructive pt-0.5">
              {t("passwordsDoNotMatch")}
            </p>
          )}
        </div>
      </div>

      {hasInput && (
        <div className="pt-2 flex items-center justify-end gap-2.5 animate-in fade-in-50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t("clear")}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={
              isSaving ||
              !currentPassword ||
              !isPasswordValid ||
              !isMatch
            }
            className="h-8 text-xs font-semibold rounded-xl px-4 gap-1.5"
          >
            {isSaving ? <Spinner className="size-3.5" /> : <IconCheck className="size-3.5" />}
            <span>{t("updatePassword")}</span>
          </Button>
        </div>
      )}
    </form>
  );
}
