"use client"

import React, { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { Badge } from "@workspace/ui/components/badge"
import {
  IconShieldCheck,
  IconAlertCircle,
  IconExternalLink,
  IconCheck,
  IconX,
  IconUser,
  IconMail,
  IconList,
  IconEdit,
  IconFlame,
  IconRefresh,
  IconLock,
} from "@tabler/icons-react"
import { elysia } from "@/lib/elysia"
import { toast } from "sonner"

interface ScopeItem {
  scope: string
  name: string
  description: string
  isDangerous?: boolean
}

interface ClientData {
  clientId: string
  name: string
  description?: string | null
  logoUrl?: string | null
  websiteUrl?: string | null
  isTrusted?: boolean
}

function getScopeIcon(scope: string): React.JSX.Element {
  switch (scope) {
    case "identify":
    case "profile":
      return <IconUser className="size-4 text-rose-500" />
    case "email":
      return <IconMail className="size-4 text-rose-500" />
    case "lists:read":
      return <IconList className="size-4 text-rose-500" />
    case "lists:write":
      return <IconEdit className="size-4 text-amber-500" />
    case "activity:read":
    case "activity:write":
      return <IconFlame className="size-4 text-amber-500" />
    case "offline_access":
      return <IconRefresh className="size-4 text-rose-500" />
    default:
      return <IconLock className="size-4 text-rose-500" />
  }
}

function OAuthAuthorizeContent(): React.JSX.Element {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: authSession, status: authStatus } = useSession()

  const clientId = searchParams.get("client_id") || ""
  const redirectUri = searchParams.get("redirect_uri") || ""
  const scope = searchParams.get("scope") || "identify profile"
  const state = searchParams.get("state") || ""
  const codeChallenge = searchParams.get("code_challenge") || ""
  const codeChallengeMethod = searchParams.get("code_challenge_method") || ""

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [clientData, setClientData] = useState<ClientData | null>(null)
  const [scopeDetails, setScopeDetails] = useState<ScopeItem[]>([])

  // Redirect to login if user is unauthenticated
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      const fullUrl = window.location.href
      router.push(`/IRIS-account/auth/login?callbackUrl=${encodeURIComponent(fullUrl)}`)
    }
  }, [authStatus, router])

  // Load client details and validation
  const loadAuthorizationInfo = useCallback(async () => {
    if (!clientId || !redirectUri) {
      setErrorMessage("Missing required client_id or redirect_uri parameters.")
      setIsLoading(false)
      return
    }

    try {
      const res = await elysia.oauth.authorize.get({
        query: {
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state: state || undefined,
          code_challenge: codeChallenge || undefined,
          code_challenge_method: codeChallengeMethod || undefined,
        },
      })

      if (res.error) {
        const errData = res.error.value as { error_description?: string; message?: string } | undefined
        setErrorMessage(errData?.error_description || errData?.message || "Invalid authorization request.")
        setIsLoading(false)
        return
      }

      const data = res.data as {
        success: boolean
        client: ClientData
        scopeDetails: ScopeItem[]
      } | null

      if (data?.success) {
        setClientData(data.client)
        setScopeDetails(data.scopeDetails || [])
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to validate authorization request.")
    } finally {
      setIsLoading(false)
    }
  }, [clientId, redirectUri, scope, state, codeChallenge, codeChallengeMethod])

  useEffect(() => {
    if (authStatus === "authenticated") {
      loadAuthorizationInfo()
    }
  }, [authStatus, loadAuthorizationInfo])

  // Handle user approval
  const handleAuthorize = async () => {
    setIsSubmitting(true)
    try {
      const res = await elysia.oauth.authorize.post(
        {
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state: state || undefined,
          code_challenge: codeChallenge || undefined,
          code_challenge_method: codeChallengeMethod || undefined,
        },
        {
          fetch: { credentials: "include" },
        }
      )

      if (res.error) {
        const errData = res.error.value as { error_description?: string; message?: string } | undefined
        const msg = errData?.error_description || errData?.message || "Failed to authorize application."
        toast.error(msg)
        setIsSubmitting(false)
        return
      }

      const postData = res.data as { redirectUrl?: string } | null
      if (postData?.redirectUrl) {
        window.location.href = postData.redirectUrl
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to complete authorization.")
      setIsSubmitting(false)
    }
  }

  // Handle user rejection
  const handleCancel = () => {
    try {
      const target = new URL(redirectUri)
      target.searchParams.set("error", "access_denied")
      target.searchParams.set("error_description", "User denied authorization.")
      if (state) {
        target.searchParams.set("state", state)
      }
      window.location.href = target.toString()
    } catch {
      router.push("/")
    }
  }

  if (authStatus === "loading" || (isLoading && !errorMessage)) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center p-4">
        <Spinner className="size-8 text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">Validating authorization request...</p>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <IconAlertCircle className="size-6" />
          </div>
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Authorization Error
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {errorMessage}
          </p>
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={() => router.push("/")}>
              Return to IRIS
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl transition-all">
        {/* Header Branding */}
        <div className="border-b border-border bg-muted/40 px-6 py-5 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            {clientData?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clientData.logoUrl}
                alt={clientData.name}
                className="size-full object-cover"
              />
            ) : (
              <IconShieldCheck className="size-7 text-primary" />
            )}
          </div>
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            {clientData?.name}
          </h1>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {clientData?.websiteUrl ? (
              <a
                href={clientData.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <span>{new URL(clientData.websiteUrl).hostname}</span>
                <IconExternalLink className="size-3" />
              </a>
            ) : (
              <span>wants to connect with your IRIS account</span>
            )}
            {clientData?.isTrusted && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                Verified
              </Badge>
            )}
          </div>
        </div>

        {/* User Account Info */}
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-3 bg-muted/20 text-xs">
          <span className="text-muted-foreground">Authorizing as:</span>
          <span className="font-medium text-foreground">
            @{authSession?.user?.username || "user"}
          </span>
        </div>

        {/* Scope Permissions List */}
        <div className="px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Requested Permissions
          </p>
          <div className="space-y-3">
            {scopeDetails.map((s) => (
              <div
                key={s.scope}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 transition-colors hover:bg-muted/20"
              >
                <div className="mt-0.5 shrink-0">{getScopeIcon(s.scope)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {s.name}
                    </span>
                    {s.isDangerous && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Write
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-border/40 bg-muted/20 p-3 text-[11px] text-muted-foreground leading-relaxed">
            By clicking <strong className="text-foreground">Authorize</strong>, you allow this application to access the resources listed above. You can revoke access at any time in your IRIS Account Settings.
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={handleCancel}
            className="h-9 px-4"
          >
            <IconX className="size-4 me-1.5" />
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleAuthorize}
            className="h-9 px-5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Spinner className="size-4 me-2" />
                Authorizing...
              </>
            ) : (
              <>
                <IconCheck className="size-4 me-1.5" />
                Authorize
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function OAuthAuthorizePage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <Spinner className="size-8 text-primary" />
        </div>
      }
    >
      <OAuthAuthorizeContent />
    </Suspense>
  )
}
