"use client"

import React from "react"
import { useTranslations } from "next-intl"
import {
  IconEye,
  IconEyeOff,
  IconFingerprint,
  IconDeviceMobile,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { useAuthIllustration } from "../auth-illustration-context"

interface LoginCredentialsProps {
  identifier: string
  setIdentifier: (val: string) => void
  password: string
  setPassword: (val: string) => void
  showPassword: boolean
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>
  credentialsError: string | null
  setCredentialsError: (val: string | null) => void
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
  onPasskeyLogin: () => void
  onGenerateQuickConnect: () => void
  footer?: React.ReactNode
}

export function LoginCredentials({
  identifier,
  setIdentifier,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  credentialsError,
  setCredentialsError,
  loading,
  onSubmit,
  onPasskeyLogin,
  onGenerateQuickConnect,
  footer,
}: LoginCredentialsProps) {
  const t = useTranslations("auth.login")
  const { setIllustration } = useAuthIllustration()

  return (
    <form onSubmit={onSubmit} className="flex flex-col justify-center">
      <FieldGroup className="gap-4 sm:gap-5">
        {/* Identifier Field */}
        <Field data-invalid={Boolean(credentialsError)}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="email" className="text-sm font-medium">
              {t("emailOrUsername")}
            </FieldLabel>
            {credentialsError && (
              <span className="text-xs font-medium text-destructive">
                {credentialsError}
              </span>
            )}
          </div>
          <Input
            id="email"
            type="text"
            placeholder={t("emailOrUsernamePlaceholder")}
            required
            disabled={loading}
            aria-invalid={Boolean(credentialsError)}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value)
              if (credentialsError) {
                setCredentialsError(null)
                setIllustration("/images/auth/character/login-default.jpg")
              }
            }}
            autoComplete="username"
            className={cn(
              "h-10 text-sm sm:h-11 md:h-12",
              credentialsError &&
                "border-destructive focus-visible:ring-destructive/30"
            )}
          />
        </Field>

        {/* Password Field */}
        <Field data-invalid={Boolean(credentialsError)}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password" className="text-sm font-medium">
              {t("password")}
            </FieldLabel>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("passwordPlaceholder")}
              required
              disabled={loading}
              aria-invalid={Boolean(credentialsError)}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (credentialsError) {
                  setCredentialsError(null)
                  setIllustration("/images/auth/character/login-default.jpg")
                }
              }}
              autoComplete="current-password"
              className={cn(
                "h-10 pe-10 text-sm sm:h-11 md:h-12",
                credentialsError &&
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
        </Field>

        {/* Primary Submit */}
        <Field>
          <Button
            type="submit"
            disabled={loading}
            className="h-10 w-full text-sm font-semibold sm:h-11 sm:text-base md:h-12"
          >
            {loading ? <Spinner className="mr-2 size-4" /> : null}
            {loading ? t("loggingIn") : t("login")}
          </Button>
        </Field>

        <FieldSeparator className="my-0.5 *:data-[slot=field-separator-content]:bg-card sm:my-1">
          {t("orContinueWith")}
        </FieldSeparator>

        {/* Alternate Auth Methods */}
        <Field className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            variant="outline"
            type="button"
            disabled={loading}
            onClick={onPasskeyLogin}
            className="h-10 w-full gap-1.5 px-2.5 text-xs font-medium sm:h-11 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <IconFingerprint className="size-4 shrink-0" />
            <span className="truncate">{t("passkey")}</span>
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={loading}
            onClick={onGenerateQuickConnect}
            className="h-10 w-full gap-1.5 px-2.5 text-xs font-medium sm:h-11 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <IconDeviceMobile className="size-4 shrink-0" />
            <span className="truncate">{t("loginWithCode")}</span>
          </Button>
        </Field>

        {footer}
      </FieldGroup>
    </form>
  )
}
