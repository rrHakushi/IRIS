"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  IconKey,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import type { ApiKeyItem } from "./types";

export interface RevealApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rawKey: string | null;
  apiKey: ApiKeyItem | null;
  isRegenerated?: boolean;
}

export function RevealApiKeyDialog({
  isOpen,
  onOpenChange,
  rawKey,
  apiKey,
  isRegenerated = false,
}: RevealApiKeyDialogProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.apiKeys");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      toast.success(t("copiedSuccess"));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(t("failedCopy"));
    }
  };

  const formattedExpiration = apiKey?.expiresAt
    ? new Date(apiKey.expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : t("never");

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-lg"
    >
      <DialogHeader>
        <div className="flex items-center gap-2.5 text-primary">
          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <IconKey className="size-4.5" />
          </div>
          <DialogTitle>
            {isRegenerated ? t("regeneratedTitle") : t("createdTitle")}
          </DialogTitle>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-1">
        {/* Warning Banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3 text-amber-300">
          <IconAlertTriangle className="size-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-200">
              {t("saveImmediately")}
            </p>
            <p className="text-amber-300/90 leading-relaxed">
              {t("saveWarningDesc")}
            </p>
          </div>
        </div>

        {/* API Key Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span className="font-medium">{t("keyLabel", { name: apiKey?.name ?? "" })}</span>
            <Badge variant="outline" className="text-[10px] h-5 px-2">
              {t("expiresLabel", { date: formattedExpiration })}
            </Badge>
          </div>
          <div className="relative flex items-center">
            <input
              type="text"
              readOnly
              value={rawKey || ""}
              className="w-full font-mono text-xs tracking-tight bg-background/80 border border-border/80 rounded-xl px-3.5 py-2.5 pr-20 select-all text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button
              type="button"
              variant={copied ? "default" : "secondary"}
              size="sm"
              onClick={handleCopy}
              className="absolute right-1.5 h-7 text-xs px-2.5 rounded-lg gap-1.5"
            >
              {copied ? (
                <>
                  <IconCheck className="size-3.5 text-emerald-400" />
                  <span>{t("copied")}</span>
                </>
              ) : (
                <>
                  <IconCopy className="size-3.5" />
                  <span>{t("copy")}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="default"
          onClick={() => onOpenChange(false)}
          className="w-full sm:w-auto rounded-xl"
        >
          {t("savedConfirmButton")}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
