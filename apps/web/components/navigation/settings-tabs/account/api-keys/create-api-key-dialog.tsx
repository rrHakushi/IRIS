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
import { Input } from "@workspace/ui/components/input";
import { Spinner } from "@workspace/ui/components/spinner";
import { IconKey, IconPlus, IconClock } from "@tabler/icons-react";
import { cn } from "@workspace/ui/lib/utils";
import { EXPIRATION_OPTIONS, type ExpirationOption } from "./types";

export interface CreateApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, expirationDays: number | null) => Promise<boolean>;
  isCreating: boolean;
}

export function CreateApiKeyDialog({
  isOpen,
  onOpenChange,
  onCreate,
  isCreating,
}: CreateApiKeyDialogProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.apiKeys");
  const [name, setName] = useState("");
  const [selectedDays, setSelectedDays] = useState<number | null>(30);
  const [error, setError] = useState<string | null>(null);

  const getDurationLabel = (days: number | null): string => {
    switch (days) {
      case 7:
        return t("durations.7days");
      case 30:
        return t("durations.30days");
      case 60:
        return t("durations.60days");
      case 90:
        return t("durations.90days");
      case 365:
        return t("durations.1year");
      case null:
      default:
        return t("durations.never");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(t("nameRequiredError"));
      return;
    }
    if (cleanName.length > 64) {
      setError(t("nameMaxLengthError"));
      return;
    }

    setError(null);
    const success = await onCreate(cleanName, selectedDays);
    if (success) {
      setName("");
      setSelectedDays(30);
    }
  };

  const handleClose = () => {
    if (isCreating) return;
    setError(null);
    setName("");
    setSelectedDays(30);
    onOpenChange(false);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
        else onOpenChange(true);
      }}
      className="sm:max-w-md"
    >
      <DialogHeader>
        <div className="flex items-center gap-2.5 text-primary">
          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <IconKey className="size-4.5" />
          </div>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        {/* Name Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="apiKeyName" className="font-semibold text-foreground">
              {t("keyNameLabel")}
            </label>
            <span className="text-muted-foreground">{name.length}/64</span>
          </div>
          <Input
            id="apiKeyName"
            type="text"
            placeholder={t("keyNamePlaceholder")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            maxLength={64}
            disabled={isCreating}
            className="w-full text-xs rounded-xl"
            autoFocus
          />
          {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>

        {/* Expiration Presets */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconClock className="size-3.5 text-muted-foreground" />
            <span>{t("expiration")}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {EXPIRATION_OPTIONS.map((opt: ExpirationOption) => {
              const isSelected = selectedDays === opt.days;
              return (
                <button
                  key={opt.days ?? "never"}
                  type="button"
                  onClick={() => setSelectedDays(opt.days)}
                  disabled={isCreating}
                  className={cn(
                    "text-xs py-2 px-3 rounded-xl border font-medium transition-all text-center",
                    isSelected
                      ? "border-primary bg-primary/15 text-primary ring-1 ring-primary/40 font-semibold shadow-xs"
                      : "border-border/70 bg-background/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {getDurationLabel(opt.days)}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {selectedDays === null
              ? t("neverExpireDesc")
              : t("expireInDaysDesc", { days: selectedDays })}
          </p>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isCreating}
            className="rounded-xl"
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={isCreating || !name.trim()}
            className="rounded-xl gap-1.5 min-w-[120px]"
          >
            {isCreating ? (
              <>
                <Spinner className="size-3.5" />
                <span>{t("creating")}</span>
              </>
            ) : (
              <>
                <IconPlus className="size-4" />
                <span>{t("createKey")}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
