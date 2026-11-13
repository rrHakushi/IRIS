"use client"

import React from "react"
import { useTranslations } from "next-intl"
import {
  IconAlertCircle,
  IconArrowRight,
  IconDeviceMobile,
  IconEye,
  IconEyeOff,
  IconFingerprint,
} from "@tabler/icons-react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
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
  header?: React.ReactNode
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
  header,
  footer,
}: LoginCredentialsProps) {
  const t = useTranslations("auth.login")

  return (
    <form onSubmit={onSubmit} className="flex flex-col justify-center gap-6">
      {header}

      <FieldGroup className="gap-4">
        {credentialsError && (
          <Alert
            variant="destructive"
            className="rounded-xl border-destructive/40 bg-destructive/10 py-2.5 text-destructive"
          >
            <IconAlertCircle className="size-4" />
            <AlertDescription className="text-xs font-medium">
              {credentialsError}
            </AlertDescription>
          </Alert>
        )}

        {/* Identifier Field */}
        <Field data-invalid={Boolean(credentialsError)}>
          <FieldLabel htmlFor="identifier" className="text-xs font-medium text-foreground/90 sm:text-sm">
            {t("emailOrUsername")}
          </FieldLabel>
          <Input
            id="identifier"
            type="text"
            placeholder={t("emailOrUsernamePlaceholder")}
            required
            disabled={loading}
            suppressHydrationWarning
            aria-invalid={Boolean(credentialsError)}
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value)
              if (credentialsError) setCredentialsError(null)
            }}
            autoComplete="username"
            className={cn(
              "h-11 rounded-xl text-sm",
              credentialsError &&
                "border-destructive focus-visible:ring-destructive/30"
            )}
          />
        </Field>

        {/* Password Field */}
        <Field data-invalid={Boolean(credentialsError)}>
          <FieldLabel htmlFor="password" className="text-xs font-medium text-foreground/90 sm:text-sm">
            {t("password")}
          </FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("passwordPlaceholder")}
              required
              disabled={loading}
              suppressHydrationWarning
              aria-invalid={Boolean(credentialsError)}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (credentialsError) setCredentialsError(null)
              }}
              autoComplete="current-password"
              className={cn(
                "h-11 rounded-xl pe-10 text-sm",
                credentialsError &&
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
        </Field>

        {/* Primary Submit */}
        <Field className="pt-1">
          <Button
            type="submit"
            isDisabled={loading}
            className="h-11 w-full gap-2 rounded-xl text-sm font-semibold"
          >
            {loading ? (
              <Spinner className="size-4" />
            ) : (
              <IconArrowRight className="size-4" />
            )}
            <span>{loading ? t("loggingIn") : t("login")}</span>
          </Button>
        </Field>

        <FieldSeparator className="my-0.5 *:data-[slot=field-separator-content]:bg-card">
          {t("orContinueWith")}
        </FieldSeparator>

        {/* Alternate Auth Methods */}
        <Field className="grid grid-cols-2 gap-2.5">
          <Button
            variant="outline"
            type="button"
            isDisabled={loading}
            onClick={onPasskeyLogin}
            className="h-10 w-full gap-2 rounded-xl px-3 text-xs font-medium sm:text-sm"
          >
            <IconFingerprint className="size-4 shrink-0" />
            <span className="truncate">{t("passkey")}</span>
          </Button>
          <Button
            variant="outline"
            type="button"
            isDisabled={loading}
            onClick={onGenerateQuickConnect}
            className="h-10 w-full gap-2 rounded-xl px-3 text-xs font-medium sm:text-sm"
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
