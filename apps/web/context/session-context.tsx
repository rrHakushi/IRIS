"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react"
import { elysia } from "@/lib/elysia"

export interface SessionUser {
  id: string
  name?: string | null
  username?: string | null
  email?: string | null
  image?: string | null
  avatarUrl?: string | null
  permissions?: number[]
}

export interface Session {
  user: SessionUser
  expires?: string
}

export type SessionStatus = "loading" | "authenticated" | "unauthenticated"

export interface SessionContextValue {
  session: Session | null
  status: SessionStatus
  update: () => Promise<Session | null>
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  status: "loading",
  update: async () => null,
})

export interface SessionProviderProps {
  children: React.ReactNode
  session?: Session | null
  refetchOnWindowFocus?: boolean
  refetchInterval?: number
  [key: string]: any
}

/**
 * Drop-in session provider backed directly by Elysia session cookie and Eden Treaty.
 */
export function SessionProvider({
  children,
  session: initialSession = null,
  refetchOnWindowFocus = false,
  refetchInterval = 0,
}: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(initialSession)
  const [status, setStatus] = useState<SessionStatus>(
    initialSession ? "authenticated" : "loading"
  )

  const fetchSession = useCallback(async (): Promise<Session | null> => {
    try {
      const { data, error } = await elysia.carina.users.me.get({
        fetch: { credentials: "include" },
      })

      if (error || !data || !data.success || !data.user) {
        setSession(null)
        setStatus("unauthenticated")
        return null
      }

      const u = data.user as any
      const newSession: Session = {
        user: {
          id: u.id,
          name: u.displayName ?? u.customization?.displayName ?? u.username,
          username: u.username,
          email: u.email ?? null,
          image: u.avatarUrl ?? u.customization?.avatarUrl ?? null,
          avatarUrl: u.avatarUrl ?? u.customization?.avatarUrl ?? null,
          permissions: u.permissions ?? [],
        },
      }

      setSession(newSession)
      setStatus("authenticated")
      return newSession
    } catch {
      setSession(null)
      setStatus("unauthenticated")
      return null
    }
  }, [])

  useEffect(() => {
    fetchSession()

    const onSessionUpdate = () => {
      fetchSession()
    }
    window.addEventListener("iris-session-updated", onSessionUpdate)

    if (refetchOnWindowFocus) {
      window.addEventListener("focus", onSessionUpdate)
    }

    let intervalId: any = null
    if (refetchInterval && refetchInterval > 0) {
      intervalId = setInterval(fetchSession, refetchInterval * 1000)
    }

    return () => {
      window.removeEventListener("iris-session-updated", onSessionUpdate)
      if (refetchOnWindowFocus) {
        window.removeEventListener("focus", onSessionUpdate)
      }
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [fetchSession, refetchOnWindowFocus, refetchInterval])

  const value = useMemo(
    () => ({
      session,
      status,
      update: fetchSession,
    }),
    [session, status, fetchSession]
  )

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

/**
 * Client hook accessing current session state.
 */
export function useSession() {
  const { session, status, update } = useContext(SessionContext)
  return {
    data: session,
    status,
    update,
  }
}

/**
 * Asynchronously fetch current active session.
 */
export async function getSession(): Promise<Session | null> {
  try {
    const { data, error } = await elysia.carina.users.me.get({
      fetch: { credentials: "include" },
    })

    if (error || !data || !data.success || !data.user) {
      return null
    }

    const u = data.user as any
    return {
      user: {
        id: u.id,
        name: u.displayName ?? u.customization?.displayName ?? u.username,
        username: u.username,
        email: u.email ?? null,
        image: u.avatarUrl ?? u.customization?.avatarUrl ?? null,
        avatarUrl: u.avatarUrl ?? u.customization?.avatarUrl ?? null,
        permissions: u.permissions ?? [],
      },
    }
  } catch {
    return null
  }
}

/**
 * Client sign in handler.
 */
export async function signIn(provider?: string, options?: any) {
  if (!provider || provider === "credentials") {
    if (
      !options?.identifier &&
      !options?.mfaTicket &&
      !options?.isPasskeyOnly &&
      options?.mfaType !== "passkey" &&
      !options?.isLoginCode
    ) {
      window.location.href = "/carina/auth/login"
      return { ok: true, error: null }
    }

    // Credentials login
    if (options?.identifier) {
      try {
        const { data, error } = await elysia.carina.auth.login.post(
          {
            identifier: options.identifier,
            password: options.password,
          },
          { fetch: { credentials: "include" } }
        )

        if (error || !data) {
          return {
            ok: false,
            error: (error?.value as any)?.message || "Invalid credentials",
          }
        }

        if ((data as any).mfaRequired || (data as any).error === "MFA_REQUIRED") {
          return {
            ok: false,
            mfaRequired: true,
            mfaTicket: (data as any).mfaTicket,
            allowedMfaTypes: (data as any).allowedMfaTypes,
            error: JSON.stringify(data),
          }
        }

        if (data.success && (data as any).token) {
          window.dispatchEvent(new Event("iris-session-updated"))
          return { ok: true, error: null }
        }

        return { ok: false, error: "Invalid credentials" }
      } catch (err: any) {
        return { ok: false, error: err.message || "Login failed" }
      }
    }

    // Quick Connect login code
    if (options?.isLoginCode) {
      window.dispatchEvent(new Event("iris-session-updated"))
      return { ok: true, error: null }
    }

    // Passkey authentication (passwordless or MFA)
    if (options?.isPasskeyOnly || options?.mfaType === "passkey") {
      try {
        const parsedResponse =
          typeof options.passkeyResponse === "string"
            ? JSON.parse(options.passkeyResponse)
            : options.passkeyResponse

        const res =
          await elysia.carina.auth.twofactor.passkeys.login.verify.post(
            {
              passkeyResponse: parsedResponse,
            },
            { fetch: { credentials: "include" } }
          )

        if (res.error || !res.data?.success) {
          return {
            ok: false,
            error:
              (res.error?.value as any)?.message ||
              "Passkey verification failed",
          }
        }

        window.dispatchEvent(new Event("iris-session-updated"))
        return { ok: true, error: null }
      } catch (err: any) {
        return {
          ok: false,
          error: err.message || "Passkey verification failed",
        }
      }
    }

    // MFA challenge verify
    if (options?.mfaTicket) {
      try {
        const mfaType = options.mfaType || "totp"
        let res: any

        if (mfaType === "backup" || mfaType === "backupcodes") {
          res = await elysia.carina.auth.twofactor.backupcodes.verify.post(
            { code: options.mfaCode, mfaTicket: options.mfaTicket },
            { fetch: { credentials: "include" } }
          )
        } else if (mfaType === "email") {
          res = await elysia.carina.auth.twofactor.email.verify.post(
            { code: options.mfaCode, mfaTicket: options.mfaTicket },
            { fetch: { credentials: "include" } }
          )
        } else {
          res = await elysia.carina.auth.twofactor.totp.verify.post(
            { code: options.mfaCode, mfaTicket: options.mfaTicket },
            { fetch: { credentials: "include" } }
          )
        }

        if (res.error || !res.data?.success) {
          return {
            ok: false,
            error: (res.error?.value as any)?.message || "Invalid MFA code",
          }
        }

        window.dispatchEvent(new Event("iris-session-updated"))
        return { ok: true, error: null }
      } catch (err: any) {
        return { ok: false, error: err.message || "MFA verification failed" }
      }
    }
  }

  window.location.href = "/carina/auth/login"
  return { ok: true, error: null }
}

/**
 * Client sign out handler.
 */
export async function signOut(options?: {
  callbackUrl?: string
  redirect?: boolean
}) {
  try {
    await elysia.carina.auth.logout.post(
      {},
      { fetch: { credentials: "include" } }
    )
  } catch (err) {
    console.error("Logout error:", err)
  }

  window.dispatchEvent(new Event("iris-session-updated"))
  const redirectUrl = options?.callbackUrl || "/carina/auth/login"
  if (options?.redirect !== false) {
    window.location.href = redirectUrl
  }
  return { url: redirectUrl }
}
