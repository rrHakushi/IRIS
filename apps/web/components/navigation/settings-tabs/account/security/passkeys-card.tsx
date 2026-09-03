"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  IconFingerprint,
  IconPlus,
  IconTrash,
  IconKey,
  IconAlertTriangle,
} from "@tabler/icons-react"
import { startRegistration } from "@simplewebauthn/browser"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"

export interface PasskeyItem {
  id: string
  name: string | null
  createdAt: string
  transports: string[]
}

export function PasskeysCard(): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.security")
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [passkeyName, setPasskeyName] = useState("")
  const [showAddInput, setShowAddInput] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetchedRef = useRef(false)

  // Fetch registered passkeys
  const fetchPasskeys = useCallback(async () => {
    try {
      setError(null)
      const res = await elysia.auth.passkeys.get({
        fetch: { credentials: "include" },
      })
      if (res.data?.passkeys) {
        setPasskeys(res.data.passkeys)
      }
    } catch (err: any) {
      console.error("[Passkeys] Failed to fetch passkeys:", err)
      setError(t("failedLoadPasskeys"))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true
      fetchPasskeys()
    }
  }, [fetchPasskeys])

  // Register a new passkey
  const handleRegisterPasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsRegistering(true)
    setError(null)

    try {
      // 1. Get registration options from server
      const optionsRes = await elysia.auth.passkeys.register.post(
        {},
        { fetch: { credentials: "include" } }
      )
      if (optionsRes.error || !optionsRes.data) {
        const errorData = optionsRes.error?.value as
          { message?: string } | undefined
        const msg = errorData?.message || t("failedInitiatePasskey")
        throw new Error(msg)
      }

      // 2. Trigger browser WebAuthn prompt
      const attResp = await startRegistration({
        optionsJSON: optionsRes.data as any,
      })

      // 3. Verify registration response on server
      const verifyRes = await elysia.auth.passkeys.register.verify.post(
        {
          passkeyResponse: attResp as any,
          name: passkeyName.trim() || undefined,
        },
        { fetch: { credentials: "include" } }
      )

      if (verifyRes.error) {
        const errorData = verifyRes.error?.value as
          { message?: string } | undefined
        const msg = errorData?.message || t("passkeyVerificationFailed")
        throw new Error(msg)
      }

      toast.success(t("passkeyRegisteredSuccess"))
      setPasskeyName("")
      setShowAddInput(false)
      await fetchPasskeys()
    } catch (err: any) {
      console.error("[Passkeys] Registration error:", err)
      if (
        err.name === "NotAllowedError" ||
        err.message?.includes("NotAllowedError")
      ) {
        toast.info(t("passkeyCancelled"))
      } else {
        const msg = err.message || t("failedRegisterPasskey")
        setError(msg)
        toast.error(msg)
      }
    } finally {
      setIsRegistering(false)
    }
  }

  // Delete a passkey
  const handleDeletePasskey = async (id: string, name: string | null) => {
    setDeletingId(id)
    setError(null)

    try {
      const res = await elysia.auth
        .passkeys({ id })
        .delete({}, { fetch: { credentials: "include" } })
      if (res.error) {
        const errorData = res.error?.value as { message?: string } | undefined
        const msg = errorData?.message || t("failedDeletePasskey")
        throw new Error(msg)
      }

      toast.success(
        t("passkeyRemoved", { name: name || t("defaultPasskeyName") })
      )
      setPasskeys((prev) => prev.filter((p) => p.id !== id))
    } catch (err: any) {
      console.error("[Passkeys] Delete error:", err)
      toast.error(err.message || t("failedDeletePasskey"))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3.5 rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-2xs sm:space-y-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <IconFingerprint className="size-4" />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-foreground">
              {t("passkeys")}
            </h4>
            {passkeys.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4.5 shrink-0 px-1.5 text-[10px] font-semibold"
              >
                {passkeys.length}
              </Badge>
            )}
          </div>
        </div>

        {!showAddInput && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddInput(true)}
            className="h-8 shrink-0 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <IconPlus className="size-3.5" />
            <span>{t("addPasskey")}</span>
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <IconAlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add Passkey Inline Form */}
      {showAddInput && (
        <form
          onSubmit={handleRegisterPasskey}
          className="animate-in space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 duration-150 fade-in-50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {t("registerNewPasskey")}
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAddInput(false)
                setPasskeyName("")
              }}
              className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t("cancel")}
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="text"
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              placeholder={t("passkeyNicknamePlaceholder")}
              className="h-9 flex-1 rounded-xl bg-background text-xs"
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              disabled={isRegistering}
              className="h-9 shrink-0 gap-1.5 rounded-xl px-4 text-xs font-semibold"
            >
              {isRegistering ? (
                <Spinner className="size-3.5" />
              ) : (
                <IconFingerprint className="size-3.5" />
              )}
              <span>{isRegistering ? t("prompting") : t("register")}</span>
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("passkeyPromptDesc")}
          </p>
        </form>
      )}

      {/* Passkeys List */}
      <div className="space-y-2 pt-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Spinner className="size-4" />
            <span>{t("loadingPasskeys")}</span>
          </div>
        ) : passkeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-2 rounded-xl border border-dashed border-border/70 bg-background/40 p-4 py-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <IconKey className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">
                {t("noPasskeysRegistered")}
              </p>
              <p className="max-w-xs text-[11px] text-muted-foreground">
                {t("noPasskeysDesc")}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/60 bg-background/60 shadow-2xs">
            {passkeys.map((pk) => {
              const formattedDate = new Date(pk.createdAt).toLocaleDateString(
                undefined,
                { year: "numeric", month: "short", day: "numeric" }
              )
              const isDeleting = deletingId === pk.id
              const displayName = pk.name || t("defaultPasskeyName")

              return (
                <div
                  key={pk.id}
                  className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-muted/30 sm:p-3.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                      <IconKey className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="block truncate text-xs font-semibold text-foreground">
                        {displayName}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        {t("addedOn", { date: formattedDate })}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={isDeleting}
                    onClick={() => handleDeletePasskey(pk.id, pk.name)}
                    className="size-7 shrink-0 cursor-pointer rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={t("deletePasskeyAria", { name: displayName })}
                  >
                    {isDeleting ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <IconTrash className="size-3.5" />
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
