"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  IconFingerprint,
  IconPlus,
  IconTrash,
  IconKey,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { startRegistration } from "@simplewebauthn/browser";
import { elysia } from "@/lib/elysia";
import { toast } from "sonner";

export interface PasskeyItem {
  id: string;
  name: string | null;
  createdAt: string;
  transports: string[];
}

export function PasskeysCard(): React.JSX.Element {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [passkeyName, setPasskeyName] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  // Fetch registered passkeys
  const fetchPasskeys = useCallback(async () => {
    try {
      setError(null);
      const res = await elysia.auth.passkeys.get({
        fetch: { credentials: "include" },
      });
      if (res.data?.passkeys) {
        setPasskeys(res.data.passkeys);
      }
    } catch (err: any) {
      console.error("[Passkeys] Failed to fetch passkeys:", err);
      setError("Failed to load passkeys.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPasskeys();
    }
  }, [fetchPasskeys]);

  // Register a new passkey
  const handleRegisterPasskey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsRegistering(true);
    setError(null);

    try {
      // 1. Get registration options from server
      const optionsRes = await elysia.auth.passkeys.register.post(
        {},
        { fetch: { credentials: "include" } }
      );
      if (optionsRes.error || !optionsRes.data) {
        const errorData = optionsRes.error?.value as { message?: string } | undefined;
        const msg =
          errorData?.message || "Failed to initiate passkey registration.";
        throw new Error(msg);
      }

      // 2. Trigger browser WebAuthn prompt
      const attResp = await startRegistration({
        optionsJSON: optionsRes.data as any,
      });

      // 3. Verify registration response on server
      const verifyRes = await elysia.auth.passkeys.register.verify.post(
        {
          passkeyResponse: attResp as any,
          name: passkeyName.trim() || undefined,
        },
        { fetch: { credentials: "include" } }
      );

      if (verifyRes.error) {
        const errorData = verifyRes.error?.value as { message?: string } | undefined;
        const msg = errorData?.message || "Passkey verification failed.";
        throw new Error(msg);
      }

      toast.success("Passkey registered successfully!");
      setPasskeyName("");
      setShowAddInput(false);
      await fetchPasskeys();
    } catch (err: any) {
      console.error("[Passkeys] Registration error:", err);
      if (
        err.name === "NotAllowedError" ||
        err.message?.includes("NotAllowedError")
      ) {
        toast.info("Passkey registration was cancelled.");
      } else {
        const msg = err.message || "Failed to register passkey.";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // Delete a passkey
  const handleDeletePasskey = async (id: string, name: string | null) => {
    setDeletingId(id);
    setError(null);

    try {
      const res = await elysia.auth.passkeys({ id }).delete(
        {},
        { fetch: { credentials: "include" } }
      );
      if (res.error) {
        const errorData = res.error?.value as { message?: string } | undefined;
        const msg = errorData?.message || "Failed to delete passkey.";
        throw new Error(msg);
      }

      toast.success(`Passkey "${name || "Passkey"}" removed.`);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      console.error("[Passkeys] Delete error:", err);
      toast.error(err.message || "Failed to remove passkey.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <IconFingerprint className="size-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="font-semibold text-sm text-foreground truncate">Passkeys</h4>
            {passkeys.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-semibold shrink-0">
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
            className="h-8 text-xs font-semibold rounded-xl gap-1.5 shrink-0"
          >
            <IconPlus className="size-3.5" />
            <span>Add Passkey</span>
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
          className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3 animate-in fade-in-50 duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Register New Passkey
            </span>
            <button
              type="button"
              onClick={() => {
                setShowAddInput(false);
                setPasskeyName("");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="text"
              value={passkeyName}
              onChange={(e) => setPasskeyName(e.target.value)}
              placeholder="Nickname (e.g. Bitwarden, MacBook Touch ID)"
              className="h-9 text-xs rounded-xl bg-background flex-1"
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              disabled={isRegistering}
              className="h-9 text-xs font-semibold rounded-xl px-4 gap-1.5 shrink-0"
            >
              {isRegistering ? (
                <Spinner className="size-3.5" />
              ) : (
                <IconFingerprint className="size-3.5" />
              )}
              <span>{isRegistering ? "Prompting..." : "Register"}</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            When you click Register, your browser or password manager will prompt you to save the passkey.
          </p>
        </form>
      )}

      {/* Passkeys List */}
      <div className="space-y-2 pt-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
            <Spinner className="size-4" />
            <span>Loading passkeys...</span>
          </div>
        ) : passkeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center rounded-xl border border-dashed border-border/70 bg-background/40 p-4 space-y-2">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <IconKey className="size-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">No passkeys registered</p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                Add a passkey to sign in effortlessly without typing your password.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/40 rounded-xl border border-border/60 bg-background/60 overflow-hidden shadow-2xs">
            {passkeys.map((pk) => {
              const formattedDate = new Date(pk.createdAt).toLocaleDateString(
                undefined,
                { year: "numeric", month: "short", day: "numeric" }
              );
              const isDeleting = deletingId === pk.id;

              return (
                <div
                  key={pk.id}
                  className="flex items-center justify-between p-3 sm:p-3.5 gap-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <IconKey className="size-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5 flex-1">
                      <span className="text-xs font-semibold text-foreground truncate block">
                        {pk.name || "Passkey"}
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Added on {formattedDate}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={isDeleting}
                    onClick={() => handleDeletePasskey(pk.id, pk.name)}
                    className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0 transition-colors"
                    aria-label={`Delete passkey ${pk.name || "Passkey"}`}
                  >
                    {isDeleting ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <IconTrash className="size-3.5" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
