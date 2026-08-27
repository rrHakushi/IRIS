"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { startAuthentication } from "@simplewebauthn/browser";
import { elysia } from "@/lib/elysia";
import { useAuthIllustration } from "../auth-illustration-context";
import { LoginCredentials } from "./login-credentials";
import { LoginQuickConnect } from "./login-quick-connect";
import { LoginMfa, type MfaType } from "./login-mfa";

type LoginView = "credentials" | "quickconnect" | "mfa";

interface LoginFormProps {
  footer?: React.ReactNode;
}

export function LoginForm({ footer }: LoginFormProps) {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { setIllustration } = useAuthIllustration();

  // Form View State
  const [view, setView] = useState<LoginView>("credentials");

  // Credentials State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [quickConnectError, setQuickConnectError] = useState<string | null>(null);

  // MFA Challenge State
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [allowedMfaTypes, setAllowedMfaTypes] = useState<MfaType[]>([]);
  const [activeMfaType, setActiveMfaType] = useState<MfaType>("totp");
  const [mfaCode, setMfaCode] = useState("");
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Quick-Connect State
  const [quickConnectCode, setQuickConnectCode] = useState<string | null>(null);
  const [quickConnectSessionToken, setQuickConnectSessionToken] = useState<string | null>(null);
  const quickConnectPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Email resend cooldown timer
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  // Clean, lifecycle-managed QuickConnect polling
  // Immediately stops when leaving the "quickconnect" view or when the browser tab is hidden
  useEffect(() => {
    if (view !== "quickconnect" || !quickConnectSessionToken) {
      if (quickConnectPollingRef.current) {
        clearInterval(quickConnectPollingRef.current);
        quickConnectPollingRef.current = null;
      }
      return;
    }

    let isPolling = true;

    const poll = async () => {
      // Do not fetch status if browser tab is backgrounded/hidden
      if (document.hidden) return;

      try {
        const statusRes = await elysia.auth.quickconnect.status.get({
          query: { sessionToken: quickConnectSessionToken },
        });

        if (!isPolling) return;

        if (statusRes.data && (statusRes.data as any).status === "approved") {
          if (quickConnectPollingRef.current) {
            clearInterval(quickConnectPollingRef.current);
            quickConnectPollingRef.current = null;
          }

          const signRes = await signIn("credentials", {
            redirect: false,
            isLoginCode: "true",
            loginCode: quickConnectSessionToken,
          });

          if (signRes?.ok) {
            handleSafeRedirect();
          }
        } else if (statusRes.data && (statusRes.data as any).status === "expired") {
          if (quickConnectPollingRef.current) {
            clearInterval(quickConnectPollingRef.current);
            quickConnectPollingRef.current = null;
          }
          setQuickConnectError("Device link code expired. Please generate a new code.");
        }
      } catch {
        // Ignore polling glitches
      }
    };

    poll();
    quickConnectPollingRef.current = setInterval(poll, 3000);

    const handleVisibilityChange = () => {
      if (!document.hidden && isPolling) {
        poll();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isPolling = false;
      if (quickConnectPollingRef.current) {
        clearInterval(quickConnectPollingRef.current);
        quickConnectPollingRef.current = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [view, quickConnectSessionToken]);

  const handleSafeRedirect = () => {
    let safeUrl = "/";
    if (callbackUrl.startsWith("/")) {
      safeUrl = callbackUrl;
    } else {
      try {
        const url = new URL(callbackUrl);
        if (url.origin === window.location.origin) {
          safeUrl = callbackUrl;
        }
      } catch {
        safeUrl = "/";
      }
    }
    router.push(safeUrl);
    router.refresh();
  };

  /**
   * Primary Login via NextAuth Credentials (Cookies Only)
   */
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredentialsError(null);
    setLoading(true);

    const cleanId = identifier.trim().toLowerCase();

    try {
      const res = await signIn("credentials", {
        redirect: false,
        identifier: cleanId,
        password,
      });

      if (res?.error) {
        try {
          const parsed = JSON.parse(res.error);
          if (parsed.error === "MFA_REQUIRED" && parsed.mfaTicket) {
            setMfaTicket(parsed.mfaTicket);
            const types = (parsed.allowedMfaTypes || ["totp"]) as MfaType[];
            setAllowedMfaTypes(types);
            setActiveMfaType(types[0] || "totp");
            setView("mfa");
            setLoading(false);
            return;
          }
        } catch {
          // Standard credentials failure
        }

        setCredentialsError(t("invalidCredentials"));
        const errText = res.error || "";
        if (errText.toLowerCase().includes("not found") || errText.toLowerCase().includes("not exist")) {
          setIllustration("/images/auth/character/login-user-not-found.jpg");
        } else {
          setIllustration("/images/auth/character/login-invalid-password.jpg");
        }
        setLoading(false);
        return;
      }

      if (res?.ok) {
        setIllustration("/images/auth/character/login-success.jpg");
        handleSafeRedirect();
      }
    } catch (err: any) {
      setCredentialsError(err.message || t("invalidCredentials"));
      setIllustration("/images/auth/character/login-invalid-password.jpg");
      setLoading(false);
    }
  };

  /**
   * Submit MFA Challenge through NextAuth Credentials Provider
   */
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaTicket || !mfaCode) return;
    setMfaError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        mfaTicket,
        mfaType: activeMfaType,
        mfaCode: mfaCode.trim(),
      });

      if (res?.error) {
        setMfaError(t("mfaFailed"));
        setLoading(false);
        return;
      }

      if (res?.ok) {
        handleSafeRedirect();
      }
    } catch (err: any) {
      setMfaError(err.message || t("mfaFailed"));
      setLoading(false);
    }
  };

  /**
   * Send Email OTP Code
   */
  const handleSendEmailOtp = async () => {
    if (!mfaTicket || emailCooldown > 0 || loading) return;
    setLoading(true);
    setMfaError(null);

    try {
      const { data, error } = await elysia.auth.email.send.post({
        mfaTicket,
      });

      if (error || !data) {
        setMfaError("Failed to send email verification code.");
      } else {
        setEmailCooldown(60);
      }
    } catch {
      setMfaError("Failed to reach mail service.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Passwordless Passkey Login
   */
  const handlePasskeyLogin = async () => {
    setLoading(true);
    setCredentialsError(null);

    try {
      const cleanId = identifier.trim().toLowerCase();
      const { data, error } = await elysia.auth.passkeys.login.post({
        identifier: cleanId || undefined,
      });

      if (error || !data) {
        throw new Error("Failed to load passkey authentication options.");
      }

      const assertion = await startAuthentication({
        optionsJSON: data as any,
      });

      const res = await signIn("credentials", {
        redirect: false,
        isPasskeyOnly: "true",
        passkeyResponse: JSON.stringify(assertion),
      });

      if (res?.error) {
        throw new Error(res.error);
      }

      if (res?.ok) {
        handleSafeRedirect();
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.message?.includes("NotAllowedError")) {
        setCredentialsError("Passkey authentication was cancelled.");
      } else {
        setCredentialsError(err.message || "Passkey authentication failed.");
      }
      setLoading(false);
    }
  };

  /**
   * Quick-Connect Device Code Generator
   */
  const handleGenerateQuickConnect = async () => {
    setView("quickconnect");
    setLoading(true);
    setQuickConnectError(null);

    try {
      const { data, error } = await elysia.auth.quickconnect.generate.post();
      if (error || !data) {
        throw new Error(t("failedGenerateCode"));
      }

      const sessionToken = (data as any).sessionToken;
      setQuickConnectCode((data as any).code || sessionToken);
      setQuickConnectSessionToken(sessionToken);
      setLoading(false);
    } catch (err: any) {
      setQuickConnectError(err.message || t("failedGenerateCode"));
      setLoading(false);
    }
  };

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
          onGenerateQuickConnect={handleGenerateQuickConnect}
          footer={footer}
        />
      )}

      {view === "quickconnect" && (
        <LoginQuickConnect
          code={quickConnectCode}
          loading={loading}
          errorMessage={quickConnectError}
          onBack={() => {
            setView("credentials");
            setQuickConnectSessionToken(null);
            setQuickConnectCode(null);
            setQuickConnectError(null);
          }}
        />
      )}

      {view === "mfa" && (
        <LoginMfa
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
            setLoading(true);
            try {
              const cleanId = identifier.trim().toLowerCase();
              const { data } = await elysia.auth.passkeys.login.post({
                identifier: cleanId || undefined,
              });
              if (data) {
                const assertion = await startAuthentication({
                  optionsJSON: data as any,
                });
                const res = await signIn("credentials", {
                  redirect: false,
                  mfaTicket,
                  mfaType: "passkey",
                  passkeyResponse: JSON.stringify(assertion),
                });
                if (res?.ok) {
                  handleSafeRedirect();
                }
              }
            } catch (err: any) {
              setMfaError(err.message || "Passkey verification cancelled.");
              setLoading(false);
            }
          }}
          onBack={() => {
            setView("credentials");
            setMfaTicket(null);
            setMfaCode("");
          }}
        />
      )}
    </>
  );
}
