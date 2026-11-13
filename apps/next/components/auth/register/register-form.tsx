"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  IconArrowRight,
  IconCheck,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react"
import { isReservedKeyword } from "@NamelessLiberty/shared"
import { elysia } from "@/lib/elysia"
import { cn } from "@workspace/ui/lib/utils"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { PasswordChecklist, type PasswordCriteria } from "./password-checklist"

interface RegisterFormProps {
  footer?: React.ReactNode
}

export function RegisterForm({ footer }: RegisterFormProps) {
  const t = useTranslations("auth.register")
  const router = useRouter()

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isPasswordActive, setIsPasswordActive] = useState(false)

  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [fieldErrors, setFieldErrors] = useState<{
    username?: string
    email?: string
    password?: string
  }>({})

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
      }

      const { data, error } = await elysia.carina.auth.register.post(payload)

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
        router.push("/carina/auth/login")
      }, 1500)
    } catch (err: any) {
      setFieldErrors({ username: err.message || t("registrationFailed") })
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col justify-center">
      <FieldGroup className="gap-4">
        {successMessage && (
          <Alert className="rounded-xl border-emerald-500/40 bg-emerald-500/10 py-2.5 text-emerald-500">
            <IconCheck className="size-4" />
            <AlertDescription className="text-xs font-medium">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Username Field */}
        <Field data-invalid={Boolean(fieldErrors.username)}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="username" className="text-xs font-medium text-foreground/90 sm:text-sm">
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
              "h-11 rounded-xl text-sm",
              fieldErrors.username &&
                "border-destructive focus-visible:ring-destructive/30"
            )}
          />
        </Field>

        {/* Email Field */}
        <Field data-invalid={Boolean(fieldErrors.email)}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="email" className="text-xs font-medium text-foreground/90 sm:text-sm">
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
              "h-11 rounded-xl text-sm",
              fieldErrors.email &&
                "border-destructive focus-visible:ring-destructive/30"
            )}
          />
        </Field>

        {/* Password Field */}
        <Field data-invalid={Boolean(fieldErrors.password)}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="password" className="text-xs font-medium text-foreground/90 sm:text-sm">
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
                "h-11 rounded-xl pe-10 text-sm",
                fieldErrors.password &&
                  "border-destructive focus-visible:ring-destructive/30"
              )}
            />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            >
              {showPassword ? (
                <IconEyeOff className="size-4" />
              ) : (
                <IconEye className="size-4" />
              )}
            </button>
          </div>

          {(isPasswordActive || password.length > 0) && (
            <PasswordChecklist
              criteria={criteria}
              strengthScore={strengthScore}
            />
          )}
        </Field>

        <Button
          type="submit"
          isDisabled={
            loading || !isPasswordValid || Boolean(fieldErrors.username)
          }
          className="mt-1 h-11 w-full gap-2 rounded-xl text-sm font-semibold"
        >
          {loading ? (
            <>
              <Spinner className="size-4" />
              <span>{t("creatingAccount")}</span>
            </>
          ) : !isPasswordValid && password.length > 0 ? (
            <span>{t("resolveIssues")}</span>
          ) : (
            <>
              <span>{t("createAccount")}</span>
              <IconArrowRight className="size-4" />
            </>
          )}
        </Button>

        {footer}
      </FieldGroup>
    </form>
  )
}
