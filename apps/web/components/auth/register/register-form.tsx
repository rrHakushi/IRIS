"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  IconEye,
  IconEyeOff,
  IconCheck,
  IconShieldLock,
  IconKey,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react"
import { isReservedKeyword } from "@IRIS/shared"
import { elysia } from "@/lib/elysia"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { PasswordChecklist, type PasswordCriteria } from "./password-checklist"
import { useAuthIllustration } from "../auth-illustration-context"

interface RegisterFormProps {
  footer?: React.ReactNode
}

export function RegisterForm({ footer }: RegisterFormProps) {
  const t = useTranslations("auth.register")
  const router = useRouter()
  const { setIllustration } = useAuthIllustration()

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isPasswordActive, setIsPasswordActive] = useState(false)

  // Separate encryption password state
  const [useSeparateEncryptionPassword, setUseSeparateEncryptionPassword] =
    useState(false)
  const [encryptionPassword, setEncryptionPassword] = useState("")
  const [showEncryptionPassword, setShowEncryptionPassword] = useState(false)
  const [isEncryptionPasswordActive, setIsEncryptionPasswordActive] =
    useState(false)

  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [fieldErrors, setFieldErrors] = useState<{
    username?: string
    email?: string
    password?: string
  }>({})

  // Password criteria verification matrix
  const criteria: PasswordCriteria = {
    length: password.length >= 12,
    maxLength: password.length > 0 && password.length <= 64,
    uppercase: /[A-Z]/.test(password),
    number: /(?:.*[0-9]){2}/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>~'_\-+=/\\\[\]\x60]/.test(password),
  }

  const isPasswordValid =
    criteria.length &&
    criteria.maxLength &&
    criteria.uppercase &&
    criteria.number &&
    criteria.special

  const strengthScore = Object.values(criteria).filter(Boolean).length

  // Separate encryption password criteria: min 16 chars, 2 numbers, 2 special chars, 1 uppercase
  const encryptionCriteria: PasswordCriteria = {
    length: encryptionPassword.length >= 16,
    maxLength: encryptionPassword.length > 0 && encryptionPassword.length <= 64,
    uppercase: /[A-Z]/.test(encryptionPassword),
    number: /(?:.*[0-9]){2}/.test(encryptionPassword),
    special: /(?:.*[!@#$%^&*(),.?":{}|<>~'_\-+=/\\\[\]\x60]){2}/.test(
      encryptionPassword
    ),
  }

  const isEncryptionPasswordValid =
    Object.values(encryptionCriteria).every(Boolean)
  const encryptionStrengthScore =
    Object.values(encryptionCriteria).filter(Boolean).length

  const encryptionRules = [
    { key: "length" as const, label: "At least 16 characters" },
    { key: "maxLength" as const, label: "At most 64 characters" },
    { key: "uppercase" as const, label: "At least 1 uppercase letter" },
    { key: "number" as const, label: "At least 2 numbers" },
    { key: "special" as const, label: "At least 2 special characters" },
  ]

  // Reactively update companion illustration based on user focus, strength, and server validation
  React.useEffect(() => {
    if (successMessage) {
      setIllustration("/images/auth/character/login-success.jpg")
      return
    }
    if (fieldErrors.email) {
      setIllustration("/images/auth/character/register-email-taken.jpg")
      return
    }
    if (fieldErrors.username) {
      setIllustration("/images/auth/character/register-username-taken.jpg")
      return
    }
    if (isPasswordActive && password.length > 0) {
      const stage = Math.min(Math.max(strengthScore, 1), 5)
      setIllustration(
        `/images/auth/character/register-password-stage-${stage}.jpg`
      )
      return
    }
    setIllustration("/images/auth/character/register-default.jpg")
  }, [
    isPasswordActive,
    password,
    strengthScore,
    fieldErrors,
    successMessage,
    setIllustration,
  ])

  const handleUsernameChange = (val: string) => {
    const sanitized = val
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 32)
    setUsername(sanitized)

    if (isReservedKeyword(sanitized)) {
      setFieldErrors((prev) => ({
        ...prev,
        username: t("usernameReserved", { username: sanitized }),
      }))
    } else if (sanitized.length > 0 && sanitized.length < 3) {
      setFieldErrors((prev) => ({
        ...prev,
        username: t("usernameMinLen"),
      }))
    } else {
      setFieldErrors((prev) => ({ ...prev, username: undefined }))
    }
  }

  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (fieldErrors.email) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || val === "") {
        setFieldErrors((prev) => ({ ...prev, email: undefined }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldErrors((prev) => ({ ...prev, email: t("invalidEmailFormat") }))
      return
    }

    const cleanUsername = username.trim().toLowerCase()
    if (isReservedKeyword(cleanUsername)) {
      setFieldErrors((prev) => ({
        ...prev,
        username: t("usernameReserved", { username: cleanUsername }),
      }))
      return
    }

    if (!isPasswordValid) {
      setFieldErrors((prev) => ({ ...prev, password: t("resolveIssues") }))
      return
    }

    setLoading(true)

    try {
      const payload = {
        username: cleanUsername,
        email: email.trim().toLowerCase(),
        password,
        ...(useSeparateEncryptionPassword && encryptionPassword.trim()
          ? { encryptionPassword: encryptionPassword.trim() }
          : {}),
      }

      const { data, error } = await elysia.auth.register.post(payload)

      if (error || !data) {
        const message =
          typeof error?.value === "object" &&
          error?.value &&
          "message" in error.value
            ? String((error.value as { message: unknown }).message)
            : t("registrationFailed")

        const lowerMsg = message.toLowerCase()
        const newErrors: typeof fieldErrors = {}

        if (lowerMsg.includes("both username and email")) {
          newErrors.username = t("usernameTaken")
          newErrors.email = t("emailTaken")
        } else if (
          lowerMsg.includes("email already exists") ||
          (lowerMsg.includes("email") && lowerMsg.includes("exist"))
        ) {
          newErrors.email = t("emailTaken")
        } else if (
          lowerMsg.includes("username is already taken") ||
          (lowerMsg.includes("username") && lowerMsg.includes("exist"))
        ) {
          newErrors.username = t("usernameTaken")
        } else if (lowerMsg.includes("reserved")) {
          newErrors.username = t("usernameReserved", {
            username: cleanUsername,
          })
        } else if (lowerMsg.includes("password")) {
          newErrors.password = message
        } else {
          newErrors.username = message
        }

        setFieldErrors(newErrors)
        setLoading(false)
        return
      }

      setFieldErrors({})
      setSuccessMessage(t("successRedirect"))
      setUsername("")
      setEmail("")
      setPassword("")

      setTimeout(() => {
        router.push("/IRIS-account/auth/login")
      }, 1500)
    } catch (err: any) {
      setFieldErrors({ username: err.message || t("registrationFailed") })
      setLoading(false)
    }
  }

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
              <FieldError className="text-xs font-medium text-destructive">
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
              "h-10 text-sm sm:h-11 md:h-12",
              fieldErrors.username &&
                "border-destructive focus-visible:ring-destructive/30"
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
              <FieldError className="text-xs font-medium text-destructive">
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
              "h-10 text-sm sm:h-11 md:h-12",
              fieldErrors.email &&
                "border-destructive focus-visible:ring-destructive/30"
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
              <FieldError className="text-xs font-medium text-destructive">
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
                setPassword(e.target.value)
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }))
                }
              }}
              onFocus={() => setIsPasswordActive(true)}
              onBlur={() => setIsPasswordActive(false)}
              placeholder={t("passwordPlaceholder")}
              autoComplete="new-password"
              className={cn(
                "h-10 pe-10 text-sm sm:h-11 md:h-12",
                fieldErrors.password &&
                  "border-destructive focus-visible:ring-destructive/30"
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

        {/* Optional Separate Encryption Password */}
        <div className="space-y-2.5 rounded-xl border border-border/50 bg-muted/20 p-3 transition-all">
          <button
            type="button"
            onClick={() => setUseSeparateEncryptionPassword((prev) => !prev)}
            className="flex w-full cursor-pointer items-center justify-between text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <div className="flex items-center gap-2">
              <IconShieldLock className="size-4 text-emerald-400" />
              <span>Use a separate Post-Quantum encryption password</span>
            </div>
            {useSeparateEncryptionPassword ? (
              <IconChevronUp className="size-3.5 opacity-70" />
            ) : (
              <IconChevronDown className="size-3.5 opacity-70" />
            )}
          </button>

          {useSeparateEncryptionPassword && (
            <div className="animate-in space-y-2 pt-1 duration-200 fade-in-50">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                By default, your account password locks your private vault. You
                can set an independent password used exclusively for
                zero-knowledge post-quantum data encryption.
              </p>
              <div className="relative">
                <Input
                  type={showEncryptionPassword ? "text" : "password"}
                  disabled={loading}
                  value={encryptionPassword}
                  minLength={16}
                  maxLength={64}
                  onFocus={() => setIsEncryptionPasswordActive(true)}
                  onBlur={() => setIsEncryptionPasswordActive(false)}
                  onChange={(e) => setEncryptionPassword(e.target.value)}
                  placeholder="Separate encryption password (min 16 chars)"
                  className="h-9 pe-10 text-xs sm:h-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowEncryptionPassword((prev) => !prev)}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showEncryptionPassword ? "Hide password" : "Show password"
                  }
                >
                  {showEncryptionPassword ? (
                    <IconEyeOff className="size-3.5" />
                  ) : (
                    <IconEye className="size-3.5" />
                  )}
                </button>
              </div>

              {/* Password visualizer - only visible when separate encryption password field is active */}
              {isEncryptionPasswordActive && (
                <PasswordChecklist
                  criteria={encryptionCriteria}
                  strengthScore={encryptionStrengthScore}
                  rules={encryptionRules}
                />
              )}
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={
            loading ||
            !isPasswordValid ||
            Boolean(fieldErrors.username) ||
            (useSeparateEncryptionPassword && !isEncryptionPasswordValid)
          }
          className="mt-1 h-10 w-full text-sm font-semibold sm:h-11 sm:text-base md:h-12"
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
  )
}
