"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "@/context/session-context"
import { useTranslations } from "next-intl"
import { startAuthentication } from "@simplewebauthn/browser"
import { elysia } from "@/lib/elysia"
import { useEncryption } from "@/context/encryption-context"
import { LoginCredentials } from "./login-credentials"
import { LoginQuickConnect } from "./login-quick-connect"
import { LoginMfa, type MfaType } from "./login-mfa"

type LoginView = "credentials" | "quickconnect" | "mfa"

interface LoginFormProps {
  header?: React.ReactNode
  footer?: React.ReactNode
}

export function LoginForm({ header, footer }: LoginFormProps) {
  const t = useTranslations("auth.login")
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  const { unlockVault } = useEncryption()

  // Form View State
  const [view, setView] = useState<LoginView>("credentials")

  // Credentials State
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Status & Feedback
  const [loading, setLoading] = useState(false)
  const [credentialsError, setCredentialsError] = useState<string | null>(null)
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [quickConnectError, setQuickConnectError] = useState<string | null>(
    null
  )

  // MFA Challenge State
  const [mfaTicket, setMfaTicket] = useState<string | null>(null)
  const [allowedMfaTypes, setAllowedMfaTypes] = useState<MfaType[]>([])
  const [activeMfaType, setActiveMfaType] = useState<MfaType>("totp")
  const [mfaCode, setMfaCode] = useState("")
  const [emailCooldown, setEmailCooldown] = useState(0)

  // Quick-Connect State
  const [quickConnectCode, setQuickConnectCode] = useState<string | null>(null)
  const [quickConnectSessionToken, setQuickConnectSessionToken] = useState<
    string | null
  >(null)
  const quickConnectPollingRef = useRef<NodeJS.Timeout | null>(null)

  // Email resend cooldown timer
  useEffect(() => {
    if (emailCooldown <= 0) return
    const timer = setInterval(() => {
      setEmailCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [emailCooldown])

  // Clean, lifecycle-managed QuickConnect polling
  useEffect(() => {
    if (view !== "quickconnect" || !quickConnectSessionToken) {
      if (quickConnectPollingRef.current) {
        clearInterval(quickConnectPollingRef.current)
        quickConnectPollingRef.current = null
      }
      return
    }

    let isPolling = true

    const poll = async () => {
      if (document.hidden) return

      try {
        const statusRes = await elysia.carina.auth.qc.status.get({
          query: { sessionToken: quickConnectSessionToken },
        })

        if (!isPolling) return

        if (statusRes.data && (statusRes.data as any).status === "approved") {
          if (quickConnectPollingRef.current) {
            clearInterval(quickConnectPollingRef.current)
            quickConnectPollingRef.current = null
          }

          const signRes = await signIn("credentials", {
            redirect: false,
            isLoginCode: "true",
            loginCode: quickConnectSessionToken,
          })

          if (signRes?.ok) {
            handleSafeRedirect()
          }
        } else if (
          statusRes.data &&
          (statusRes.data as any).status === "expired"
        ) {
          if (quickConnectPollingRef.current) {
            clearInterval(quickConnectPollingRef.current)
            quickConnectPollingRef.current = null
          }
          setQuickConnectError(t("deviceCodeExpired"))
        }
      } catch {
        // Ignore polling glitches
      }
    }

    poll()
    quickConnectPollingRef.current = setInterval(poll, 3000)

    const handleVisibilityChange = () => {
      if (!document.hidden && isPolling) {
        poll()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      isPolling = false
      if (quickConnectPollingRef.current) {
        clearInterval(quickConnectPollingRef.current)
        quickConnectPollingRef.current = null
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [view, quickConnectSessionToken])

  const handleSafeRedirect = () => {
    let safeUrl = "/"
    if (callbackUrl.startsWith("/")) {
      safeUrl = callbackUrl
    } else {
      try {
        const url = new URL(callbackUrl)
        if (url.origin === window.location.origin) {
          safeUrl = callbackUrl
        }
      } catch {
        safeUrl = "/"
      }
    }
    router.push(safeUrl)
    router.refresh()
  }

  /**
   * Primary Login via NextAuth Credentials (Cookies Only)
   */
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCredentialsError(null)
    setLoading(true)

    const cleanId = identifier.trim().toLowerCase()

    try {
      const res: any = await signIn("credentials", {
        redirect: false,
        identifier: cleanId,
        password,
      })

      if (res?.mfaRequired && res?.mfaTicket) {
        setMfaTicket(res.mfaTicket)
        const types = (res.allowedMfaTypes || ["totp"]) as MfaType[]
        setAllowedMfaTypes(types)
        setActiveMfaType(types[0] || "totp")
        setMfaError(null)
        setMfaCode("")
        setView("mfa")
        setLoading(false)
        return
      }

      if (res?.error) {
        try {
          const parsed = JSON.parse(res.error)
          if (
            (parsed.error === "MFA_REQUIRED" || parsed.mfaRequired) &&
            parsed.mfaTicket
          ) {
            setMfaTicket(parsed.mfaTicket)
            const types = (parsed.allowedMfaTypes || ["totp"]) as MfaType[]
            setAllowedMfaTypes(types)
            setActiveMfaType(types[0] || "totp")
            setMfaError(null)
            setMfaCode("")
            setView("mfa")
            setLoading(false)
            return
          }
        } catch {
          // Standard credentials failure
        }

        setCredentialsError(t("invalidCredentials"))
        setLoading(false)
        return
      }

      if (res?.ok) {
        if (password) {
          try {
            await unlockVault(password)
          } catch {
            // Separate encryption password required; vault remains locked
          }
        }
        handleSafeRedirect()
      }
    } catch (err: any) {
      setCredentialsError(err.message || t("invalidCredentials"))
      setLoading(false)
    }
  }

  /**
   * Submit MFA Challenge through NextAuth Credentials Provider
   */
  const handleMfaSubmit = async (
    e?: React.FormEvent,
    codeOverride?: string
  ) => {
    e?.preventDefault()
    const codeToSubmit = (codeOverride ?? mfaCode).trim()
    if (!mfaTicket || !codeToSubmit) return
    setMfaError(null)
    setLoading(true)

    try {
      const res = await signIn("credentials", {
        redirect: false,
        mfaTicket,
        mfaType: activeMfaType,
        mfaCode: codeToSubmit,
      })

      if (res?.error) {
        setMfaError(t("mfaFailed"))
        setLoading(false)
        return
      }

      if (res?.ok) {
        if (password) {
          try {
            await unlockVault(password)
          } catch {
            // Ignored if separate password required
          }
        }
        handleSafeRedirect()
      }
    } catch (err: any) {
      setMfaError(err.message || t("mfaFailed"))
      setLoading(false)
    }
  }

  /**
   * Send Email OTP Code
   */
  const handleSendEmailOtp = async () => {
    if (!mfaTicket || emailCooldown > 0 || loading) return
    setLoading(true)
    setMfaError(null)

    try {
      const { data, error } =
        await elysia.carina.auth.twofactor.email.send.post({
          mfaTicket,
        })

      if (error || !data) {
        setMfaError(t("failedSendEmailOtp"))
      } else {
        setEmailCooldown(60)
      }
    } catch {
      setMfaError(t("failedReachMailService"))
    } finally {
      setLoading(false)
    }
  }

  /**
   * Passwordless Passkey Login
   */
  const handlePasskeyLogin = async () => {
    setLoading(true)
    setCredentialsError(null)

    try {
      const cleanId = identifier.trim().toLowerCase()
      const { data, error } =
        await elysia.carina.auth.twofactor.passkeys.login.post(
          cleanId ? { identifier: cleanId } : {}
        )

      if (error || !data) {
        throw new Error("FAILED_LOAD_PASSKEY_OPTIONS")
      }

      const assertion = await startAuthentication({
        optionsJSON: data as any,
      })

      const res = await signIn("credentials", {
        redirect: false,
        isPasskeyOnly: "true",
        passkeyResponse: JSON.stringify(assertion),
      })

      if (res?.error) {
        throw new Error(res.error)
      }

      if (res?.ok) {
        handleSafeRedirect()
      }
    } catch (err: any) {
      if (
        err.name === "NotAllowedError" ||
        err.message?.includes("NotAllowedError")
      ) {
        setCredentialsError(t("passkeyCancelled"))
      } else if (err.message === "FAILED_LOAD_PASSKEY_OPTIONS") {
        setCredentialsError(t("failedLoadPasskeyOptions"))
      } else {
        setCredentialsError(t("passkeyFailed"))
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Quick-Connect Device Code Generator
   */
  const handleGenerateQuickConnect = async (customIdentifier?: string) => {
    setView("quickconnect")
    setLoading(true)
    setQuickConnectError(null)

    try {
      const targetIdent = (customIdentifier ?? identifier).trim() || undefined
      const { data, error } =
        await elysia.carina.auth.qc.generate.post({
          userIdentifier: targetIdent,
        })
      if (error || !data) {
        throw new Error(t("failedGenerateCode"))
      }

      const sessionToken = data.sessionToken
      setQuickConnectCode(data.code || sessionToken)
      setQuickConnectSessionToken(sessionToken)
      setLoading(false)
    } catch (err: any) {
      setQuickConnectError(err.message || t("failedGenerateCode"))
      setLoading(false)
    }
  }

  return (
    <>
      {view === "credentials" && (
        <LoginCredentials
          identifier={identifier}
          setIdentifier={setIdentifier}
          password={password}
          setPassword={setPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          credentialsError={credentialsError}
          setCredentialsError={setCredentialsError}
          loading={loading}
          onSubmit={handleCredentialsSubmit}
          onPasskeyLogin={handlePasskeyLogin}
          onGenerateQuickConnect={() => handleGenerateQuickConnect()}
          header={header}
          footer={footer}
        />
      )}

      {view === "quickconnect" && (
        <LoginQuickConnect
          code={quickConnectCode}
          loading={loading}
          errorMessage={quickConnectError}
          initialIdentifier={identifier}
          onSendNotification={async (targetIdent) => {
            await handleGenerateQuickConnect(targetIdent)
          }}
          onBack={() => {
            setView("credentials")
            setQuickConnectSessionToken(null)
            setQuickConnectCode(null)
            setQuickConnectError(null)
          }}
        />
      )}

      {view === "mfa" && (
        <LoginMfa
          identifier={identifier.trim() || undefined}
          allowedTypes={allowedMfaTypes}
          activeType={activeMfaType}
          setActiveType={setActiveMfaType}
          mfaCode={mfaCode}
          setMfaCode={setMfaCode}
          loading={loading}
          errorMessage={mfaError}
          emailCooldown={emailCooldown}
          onSubmit={handleMfaSubmit}
          onSendEmailOtp={handleSendEmailOtp}
          onRetryPasskey={async () => {
            setLoading(true)
            setMfaError(null)
            try {
              const cleanId = identifier.trim().toLowerCase()
              const { data, error } =
                await elysia.carina.auth.twofactor.passkeys.login.post(
                  cleanId ? { identifier: cleanId } : {}
                )
              if (error || !data) {
                throw new Error("FAILED_LOAD_PASSKEY_OPTIONS")
              }
              const assertion = await startAuthentication({
                optionsJSON: data as any,
              })
              const res = await signIn("credentials", {
                redirect: false,
                mfaTicket,
                mfaType: "passkey",
                passkeyResponse: JSON.stringify(assertion),
              })
              if (res?.error) {
                throw new Error(res.error)
              }
              if (res?.ok) {
                handleSafeRedirect()
              }
            } catch (err: any) {
              if (
                err.name === "NotAllowedError" ||
                err.message?.includes("NotAllowedError")
              ) {
                setMfaError(t("passkeyVerificationCancelled"))
              } else if (err.message === "FAILED_LOAD_PASSKEY_OPTIONS") {
                setMfaError(t("failedLoadPasskeyOptions"))
              } else {
                setMfaError(t("passkeyFailed"))
              }
            } finally {
              setLoading(false)
            }
          }}
          onBack={() => {
            setView("credentials")
            setMfaTicket(null)
            setMfaCode("")
            setMfaError(null)
          }}
        />
      )}
    </>
  )
}
