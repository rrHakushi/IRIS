"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { Switch } from "@workspace/ui/components/switch"
import { Badge } from "@workspace/ui/components/badge"
import { IconMail, IconMailCheck } from "@tabler/icons-react"

export interface Email2faCardProps {
  enabled: boolean
  originalEnabled: boolean
  email: string
  onChange: (enabled: boolean) => void
  disabled?: boolean
}

export function Email2faCard({
  enabled,
  originalEnabled,
  email,
  onChange,
  disabled = false,
}: Email2faCardProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.security")
  const isDirty = enabled !== originalEnabled

  return (
    <div className="space-y-3.5 rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-2xs sm:space-y-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <IconMail className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                {t("emailTwoFactor")}
              </h4>
              {enabled ? (
                <Badge
                  variant="outline"
                  className="h-4.5 border-emerald-500/30 bg-emerald-500/10 px-2 text-[10px] font-semibold text-emerald-400"
                >
                  {t("enabled")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-4.5 border-border px-2 text-[10px] font-medium text-muted-foreground"
                >
                  {t("disabled")}
                </Badge>
              )}
              {isDirty && (
                <span className="animate-pulse rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                  {t("pendingSave")}
                </span>
              )}
            </div>
          </div>
        </div>

        <Switch
          isSelected={enabled}
          onChange={onChange}
          isDisabled={disabled}
          aria-label={t("toggleEmail2faAria")}
        />
      </div>

      <div className="flex flex-col justify-between gap-2 rounded-xl border border-border/50 bg-background/50 p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <IconMailCheck className="size-4 shrink-0 text-primary" />
          <span>{t("codesDeliveredTo")}</span>
        </div>
        <span className="truncate rounded-lg border border-border/60 bg-muted/60 px-2.5 py-1 font-mono text-xs font-medium text-foreground">
          {email || t("noEmailLinked")}
        </span>
      </div>
    </div>
  )
}
