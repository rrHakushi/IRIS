"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconEye,
  IconEyeOff,
  IconCheck,
} from "@tabler/icons-react";
import { isReservedKeyword } from "@IRIS/shared";
import { elysia } from "@/lib/elysia";
import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { PasswordChecklist, type PasswordCriteria } from "./password-checklist";
import { useAuthIllustration } from "../auth-illustration-context";

interface RegisterFormProps {
  footer?: React.ReactNode;
}

export function RegisterForm({ footer }: RegisterFormProps) {
  const t = useTranslations("auth.register");
  const router = useRouter();
  const { setIllustration } = useAuthIllustration();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordActive, setIsPasswordActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
  }>({});

  // Password criteria verification matrix
  const criteria: PasswordCriteria = {
    length: password.length >= 12,
    maxLength: password.length > 0 && password.length <= 64,
    uppercase: /[A-Z]/.test(password),
    number: /(?:.*[0-9]){2}/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>~'_\-+=/\\\[\]\x60]/.test(password),
  };

  const isPasswordValid =
    criteria.length &&
    criteria.maxLength &&
    criteria.uppercase &&
    criteria.number &&
    criteria.special;

  const strengthScore = Object.values(criteria).filter(Boolean).length;

  // Reactively update companion illustration based on user focus, strength, and server validation
  React.useEffect(() => {
    if (successMessage) {
      setIllustration("/images/auth/character/login-success.jpg");
      return;
    }
    if (fieldErrors.email) {
      setIllustration("/images/auth/character/register-email-taken.jpg");
      return;
    }
    if (fieldErrors.username) {
      setIllustration("/images/auth/character/register-username-taken.jpg");
      return;
    }
    if (isPasswordActive && password.length > 0) {
      const stage = Math.min(Math.max(strengthScore, 1), 5);
      setIllustration(`/images/auth/character/register-password-stage-${stage}.jpg`);
      return;
    }
    setIllustration("/images/auth/character/register-default.jpg");
  }, [isPasswordActive, password, strengthScore, fieldErrors, successMessage, setIllustration]);

  const handleUsernameChange = (val: string) => {
    const sanitized = val.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32);
    setUsername(sanitized);

    if (isReservedKeyword(sanitized)) {
      setFieldErrors((prev) => ({
        ...prev,
        username: t("usernameReserved", { username: sanitized }),
      }));
    } else if (sanitized.length > 0 && sanitized.length < 3) {
      setFieldErrors((prev) => ({
        ...prev,
        username: t("usernameMinLen"),
      }));
    } else {
      setFieldErrors((prev) => ({ ...prev, username: undefined }));
    }
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (fieldErrors.email) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || val === "") {
        setFieldErrors((prev) => ({ ...prev, email: undefined }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors((prev) => ({ ...prev, email: t("invalidEmailFormat") }));
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (isReservedKeyword(cleanUsername)) {
      setFieldErrors((prev) => ({
        ...prev,
        username: t("usernameReserved", { username: cleanUsername }),
      }));
      return;
    }

    if (!isPasswordValid) {
      setFieldErrors((prev) => ({ ...prev, password: t("resolveIssues") }));
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await elysia.auth.register.post({
        username: cleanUsername,
        email: email.trim().toLowerCase(),
        password,
      });

      if (error || !data) {
        const message =
          typeof error?.value === "object" && error?.value && "message" in error.value
            ? String((error.value as { message: unknown }).message)
            : t("registrationFailed");

        const lowerMsg = message.toLowerCase();
        const newErrors: typeof fieldErrors = {};

        if (lowerMsg.includes("both username and email")) {
          newErrors.username = t("usernameTaken");
          newErrors.email = t("emailTaken");
        } else if (lowerMsg.includes("email already exists") || (lowerMsg.includes("email") && lowerMsg.includes("exist"))) {
          newErrors.email = t("emailTaken");
        } else if (lowerMsg.includes("username is already taken") || (lowerMsg.includes("username") && lowerMsg.includes("exist"))) {
          newErrors.username = t("usernameTaken");
        } else if (lowerMsg.includes("reserved")) {
          newErrors.username = t("usernameReserved", { username: cleanUsername });
        } else if (lowerMsg.includes("password")) {
          newErrors.password = message;
        } else {
          newErrors.username = message;
        }

        setFieldErrors(newErrors);
        setLoading(false);
        return;
      }

      setFieldErrors({});
      setSuccessMessage(t("successRedirect"));
      setUsername("");
      setEmail("");
      setPassword("");

      setTimeout(() => {
        router.push("/auth/login");
      }, 1600);
    } catch (err: any) {
      setFieldErrors({ username: err.message || t("registrationFailed") });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col justify-center">
      <FieldGroup className="gap-4 sm:gap-5">
        {/* Success Banner */}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs font-medium text-primary">
            <IconCheck className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Username Field */}
        <Field data-invalid={Boolean(fieldErrors.username)}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="username" className="text-sm font-medium">
              {t("username")}
            </FieldLabel>
            {fieldErrors.username && (
              <FieldError className="text-xs text-destructive font-medium">
                {fieldErrors.username}
              </FieldError>
            )}
          </div>
          <Input
            id="username"
            type="text"
            required
            disabled={loading}
            aria-invalid={Boolean(fieldErrors.username)}
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            placeholder={t("usernamePlaceholder")}
            autoComplete="username"
            className={cn(
              "h-10 sm:h-11 md:h-12 text-sm",
              fieldErrors.username && "border-destructive focus-visible:ring-destructive/30"
            )}
          />
        </Field>

        {/* Email Field */}
        <Field data-invalid={Boolean(fieldErrors.email)}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="email" className="text-sm font-medium">
              {t("email")}
            </FieldLabel>
            {fieldErrors.email && (
              <FieldError className="text-xs text-destructive font-medium">
                {fieldErrors.email}
              </FieldError>
            )}
          </div>
          <Input
            id="email"
            type="email"
            required
            disabled={loading}
            aria-invalid={Boolean(fieldErrors.email)}
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            className={cn(
              "h-10 sm:h-11 md:h-12 text-sm",
              fieldErrors.email && "border-destructive focus-visible:ring-destructive/30"
            )}
          />
        </Field>

        {/* Password Field */}
        <Field data-invalid={Boolean(fieldErrors.password)}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password" className="text-sm font-medium">
              {t("password")}
            </FieldLabel>
            {fieldErrors.password && (
              <FieldError className="text-xs text-destructive font-medium">
                {fieldErrors.password}
              </FieldError>
            )}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              disabled={loading}
              aria-invalid={Boolean(fieldErrors.password)}
              value={password}
              maxLength={64}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              onFocus={() => setIsPasswordActive(true)}
              onBlur={() => setIsPasswordActive(false)}
              placeholder={t("passwordPlaceholder")}
              autoComplete="new-password"
              className={cn(
                "h-10 sm:h-11 md:h-12 text-sm pe-10",
                fieldErrors.password && "border-destructive focus-visible:ring-destructive/30"
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute end-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            >
              {showPassword ? (
                <IconEyeOff className="size-4" />
              ) : (
                <IconEye className="size-4" />
              )}
            </button>
          </div>

          {/* Password Strength Checklist - only visible when password field is active */}
          {isPasswordActive && (
            <PasswordChecklist
              criteria={criteria}
              strengthScore={strengthScore}
            />
          )}
        </Field>

        <Button
          type="submit"
          disabled={loading || !isPasswordValid || Boolean(fieldErrors.username)}
          className="w-full h-10 sm:h-11 md:h-12 text-sm sm:text-base font-semibold mt-1"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <Spinner className="size-4" />
              <span>{t("creatingAccount")}</span>
            </div>
          ) : !isPasswordValid ? (
            t("resolveIssues")
          ) : (
            t("createAccount")
          )}
        </Button>

        {footer}
      </FieldGroup>
    </form>
  );
}
