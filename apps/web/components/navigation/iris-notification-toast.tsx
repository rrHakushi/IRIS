"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  IconCheck,
  IconX,
  IconLock,
  IconSend,
  IconArrowRight,
  IconSquare,
  IconSquareCheck,
} from "@tabler/icons-react";
import { cn } from "@workspace/ui/lib/utils";
import type { NotificationItem, NotificationPriority } from "@/context/notification-context";

export interface IrisNotificationToastProps {
  toastId: string | number;
  item: NotificationItem;
  onSubmitAction: (
    id: string,
    action: string,
    payload?: Record<string, unknown>
  ) => Promise<boolean>;
  onOpenModal: () => void;
  onDismiss: () => void;
}

export function IrisNotificationToast({
  toastId,
  item,
  onSubmitAction,
  onOpenModal,
  onDismiss,
}: IrisNotificationToastProps): React.JSX.Element {
  const t = useTranslations("navigation.notifications");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvedStatus, setResolvedStatus] = useState<string | null>(null);

  // Form states for inputs/selects in toast
  const [selectedSingle, setSelectedSingle] = useState<string>("");
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const isMulti = Boolean(item.content?.actionSelect?.isMultiSelect);

  const getAppLabel = (appVal: string) => {
    if (appVal.toLowerCase() === "system") return t("appSystem");
    return appVal;
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case "URGENT":
        return (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 font-bold">
            {t("urgent")}
          </Badge>
        );
      case "HIGH":
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-semibold border-primary/50 text-primary bg-primary/10"
          >
            {t("high")}
          </Badge>
        );
      case "NORMAL":
        return (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 font-medium text-secondary-foreground bg-secondary/80 border border-border/40"
          >
            {t("normal")}
          </Badge>
        );
      case "LOW":
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground border-border/50 bg-muted/30"
          >
            {t("low")}
          </Badge>
        );
    }
  };

  const handleConfirmAction = async (action: "CONFIRM" | "REJECT") => {
    setIsSubmitting(true);
    const success = await onSubmitAction(item.id, action);
    setIsSubmitting(false);
    if (success) {
      setResolvedStatus(action === "CONFIRM" ? t("approved") : t("denied"));
      setTimeout(onDismiss, 1200);
    }
  };

  const handleSingleSelect = async (value: string) => {
    setSelectedSingle(value);
    setIsSubmitting(true);
    const success = await onSubmitAction(item.id, "SUBMIT", { selection: value });
    setIsSubmitting(false);
    if (success) {
      setResolvedStatus(t("submitted"));
      setTimeout(onDismiss, 1200);
    }
  };

  const handleMultiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMulti.length === 0) return;
    setIsSubmitting(true);
    const success = await onSubmitAction(item.id, "SUBMIT", { selection: selectedMulti });
    setIsSubmitting(false);
    if (success) {
      setResolvedStatus(t("submitted"));
      setTimeout(onDismiss, 1200);
    }
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await onSubmitAction(item.id, "SUBMIT", inputValues);
    setIsSubmitting(false);
    if (success) {
      setResolvedStatus(t("submitted"));
      setTimeout(onDismiss, 1200);
    }
  };

  return (
    <div className="w-[360px] sm:w-[400px] rounded-2xl bg-card border border-border text-card-foreground p-3.5 shadow-2xl backdrop-blur-xl flex flex-col gap-2.5 transition-all duration-150 relative isolate">
      {/* 1. Header: Meta Badges + Close Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-background/80">
            {getAppLabel(item.app)}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 rounded-lg text-muted-foreground">
            {item.category}
          </Badge>
          {getPriorityBadge(item.priority)}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="size-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          aria-label={t("close")}
        >
          <IconX className="size-3.5" />
        </button>
      </div>

      {/* 2. Decrypted Content or Locked Banner */}
      {item.isDecrypted && item.content ? (
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-foreground leading-snug">
            {item.content.title}
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {item.content.body}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 py-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <IconLock className="size-3.5 text-muted-foreground" />
            <span>{t("lockedBannerTitle")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("unlockToastDesc")}
          </p>
        </div>
      )}

      {/* 3. Action Area */}
      {resolvedStatus ? (
        <div className="pt-1 flex items-center gap-1.5">
          <Badge variant="default" className="text-xs px-2.5 py-1 rounded-xl font-semibold gap-1">
            <IconCheck className="size-3.5" />
            {resolvedStatus}
          </Badge>
        </div>
      ) : item.isDecrypted && item.content ? (
        <div className="pt-1">
          {/* A. ACTION_CONFIRM in Toast */}
          {item.type === "ACTION_CONFIRM" && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={item.content.actionConfirm?.confirmVariant || "default"}
                disabled={isSubmitting}
                onPress={() => handleConfirmAction("CONFIRM")}
                className="text-xs h-7.5 rounded-xl px-3 cursor-pointer"
              >
                <IconCheck className="size-3.5 mr-1" />
                {item.content.actionConfirm?.confirmLabel || t("confirm")}
              </Button>
              <Button
                size="sm"
                variant={item.content.actionConfirm?.rejectVariant || "outline"}
                disabled={isSubmitting}
                onPress={() => handleConfirmAction("REJECT")}
                className="text-xs h-7.5 rounded-xl px-3 cursor-pointer"
              >
                <IconX className="size-3.5 mr-1" />
                {item.content.actionConfirm?.rejectLabel || t("reject")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  onDismiss();
                  onOpenModal();
                }}
                className="text-xs h-7.5 rounded-xl px-2 text-muted-foreground hover:text-foreground cursor-pointer ml-auto"
              >
                {t("details")}
              </Button>
            </div>
          )}

          {/* B. ACTION_SELECT in Toast */}
          {item.type === "ACTION_SELECT" && item.content.actionSelect && (
            <div className="space-y-2">
              {isMulti ? (
                <form onSubmit={handleMultiSubmit} className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
                    {item.content.actionSelect.options.map((opt) => {
                      const isChecked = selectedMulti.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setSelectedMulti((prev) =>
                              prev.includes(opt.value)
                                ? prev.filter((v) => v !== opt.value)
                                : [...prev, opt.value]
                            );
                          }}
                          className={cn(
                            "flex items-center gap-1.5 text-left p-1.5 rounded-lg border text-xs cursor-pointer transition-colors",
                            isChecked
                              ? "bg-primary/15 border-primary/40 text-primary font-semibold"
                              : "bg-background/70 border-border/70 text-foreground hover:border-border"
                          )}
                        >
                          {isChecked ? (
                            <IconSquareCheck className="size-3.5 text-primary shrink-0" />
                          ) : (
                            <IconSquare className="size-3.5 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmitting || selectedMulti.length === 0}
                      className="text-xs h-7.5 rounded-xl px-3 cursor-pointer"
                    >
                      <IconCheck className="size-3.5 mr-1" />
                      {t("submitSelected", { count: selectedMulti.length })}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        onDismiss();
                        onOpenModal();
                      }}
                      className="text-xs h-7.5 rounded-xl px-2 text-muted-foreground hover:text-foreground cursor-pointer ml-auto"
                    >
                      {t("details")}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.content.actionSelect.options.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={selectedSingle === opt.value ? "default" : "outline"}
                        disabled={isSubmitting}
                        onPress={() => handleSingleSelect(opt.value)}
                        className="text-xs h-7 rounded-xl px-2.5 cursor-pointer"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* C. ACTION_INPUT in Toast */}
          {item.type === "ACTION_INPUT" && item.content.actionInputs && (
            <form onSubmit={handleInputSubmit} className="space-y-2">
              <div className="space-y-1.5">
                {item.content.actionInputs.slice(0, 2).map((inp) => (
                  <Input
                    key={inp.id}
                    type={inp.type || "text"}
                    placeholder={inp.placeholder || inp.label}
                    required={inp.required}
                    value={inputValues[inp.id] || ""}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, [inp.id]: e.target.value }))
                    }
                    className="h-7 text-xs rounded-xl bg-background/80"
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs h-7.5 rounded-xl px-3 cursor-pointer"
                >
                  <IconSend className="size-3.5 mr-1" />
                  {t("submit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    onDismiss();
                    onOpenModal();
                  }}
                  className="text-xs h-7.5 rounded-xl px-2 text-muted-foreground hover:text-foreground cursor-pointer ml-auto"
                >
                  {t("details")}
                </Button>
              </div>
            </form>
          )}

          {/* D. INFO in Toast */}
          {item.type === "INFO" && (
            <div className="flex items-center gap-2">
              {item.content.link ? (
                <a
                  href={item.content.link}
                  onClick={onDismiss}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <span>{t("openReference")}</span>
                  <IconArrowRight className="size-3.5" />
                </a>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  onDismiss();
                  onOpenModal();
                }}
                className="text-xs h-7 rounded-xl px-2.5 cursor-pointer ml-auto"
              >
                {t("view")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* Encrypted state action button */
        <div className="pt-1 flex items-center justify-end">
          <Button
            size="sm"
            onPress={() => {
              onDismiss();
              onOpenModal();
            }}
            className="text-xs h-7.5 rounded-xl px-3 cursor-pointer"
          >
            {t("unlockAndView")}
          </Button>
        </div>
      )}
    </div>
  );
}
