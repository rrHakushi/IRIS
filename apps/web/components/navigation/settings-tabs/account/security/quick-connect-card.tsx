"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import {
  IconDeviceTv,
  IconCheck,
  IconAlertTriangle,
  IconClipboard,
} from "@tabler/icons-react";
import { elysia } from "@/lib/elysia";
import { toast } from "sonner";

export function QuickConnectCard(): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.security");
  const [code, setCode] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Format code as XXXX-XXXX or uppercase alphanumeric
  const handleCodeChange = (raw: string) => {
    setError(null);
    setSuccess(null);
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length <= 4) {
      setCode(clean);
    } else {
      setCode(`${clean.slice(0, 4)}-${clean.slice(4, 8)}`);
    }
  };

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleCodeChange(text.trim());
      }
    } catch {
      toast.error(t("failedReadClipboard"));
    }
  };

  // Submit Quick Connect Code approval
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setIsApproving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await elysia.auth.quickconnect.approve.post(
        {
          code: cleanCode,
        },
        {
          fetch: { credentials: "include" },
        }
      );

      if (res.error) {
        const errorData = res.error?.value as { message?: string } | undefined;
        const msg =
          errorData?.message || t("invalidOrExpiredCode");
        throw new Error(msg);
      }

      setSuccess(t("deviceLinkedSuccess"));
      toast.success(t("deviceApprovedSuccess"));
      setCode("");
    } catch (err: any) {
      console.error("[QuickConnect] Approval error:", err);
      const msg = err.message || t("failedApproveCode");
      setError(msg);
      toast.error(msg);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <form onSubmit={handleApprove} className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <IconDeviceTv className="size-4" />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm text-foreground">
              {t("quickConnect")}
            </h4>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50">
          <IconAlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 animate-in fade-in-50">
          <IconCheck className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="space-y-3 pt-1">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">
            {t("pairingCodeLabel")}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="XXXX-XXXX"
                maxLength={9}
                className="h-10 text-xs font-mono tracking-widest uppercase rounded-xl bg-background/70 pe-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={handlePaste}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title={t("pasteClipboardTitle")}
              >
                <IconClipboard className="size-4" />
              </button>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={isApproving || code.replace(/[^A-Z0-9]/g, "").length < 6}
              className="h-10 text-xs font-semibold rounded-xl px-4 gap-1.5 shrink-0"
            >
              {isApproving ? (
                <Spinner className="size-3.5" />
              ) : (
                <IconCheck className="size-3.5" />
              )}
              <span>{t("approveDevice")}</span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
