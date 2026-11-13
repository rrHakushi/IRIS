"use client"

import React from "react"
import { useTranslations } from "next-intl"
import { IconCheck, IconCircle } from "@tabler/icons-react"
import { cn } from "@workspace/ui/lib/utils"

export interface PasswordCriteria {
  length: boolean
  maxLength: boolean
  uppercase: boolean
  number: boolean
  special: boolean
}

export interface PasswordRule {
  key: keyof PasswordCriteria
  label: string
}

interface PasswordChecklistProps {
  criteria: PasswordCriteria
  strengthScore: number
  rules?: readonly PasswordRule[]
}

export function PasswordChecklist({
  criteria,
  strengthScore,
  rules: customRules,
}: PasswordChecklistProps) {
  const t = useTranslations("auth.register")

  const defaultRules: readonly PasswordRule[] = [
    { key: "length", label: t("passwordMinLen") },
    { key: "maxLength", label: t("passwordMaxLen") },
    { key: "uppercase", label: t("passwordUpper") },
    { key: "number", label: t("passwordNumber") },
    { key: "special", label: t("passwordSpecial") },
  ]

  const rules = customRules || defaultRules

  const strengthLabel =
    strengthScore >= 5
      ? t("passwordStrengthStrong")
      : strengthScore >= 4
        ? t("passwordStrengthGood")
        : strengthScore >= 3
          ? t("passwordStrengthFair")
          : t("passwordStrengthWeak")

  return (
    <div className="mt-1.5 flex flex-col gap-2.5 rounded-xl border border-border/70 bg-muted/35 p-3.5 text-xs">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-muted-foreground">
          {t("passwordStrengthLabel")}
        </span>
        <span
          className={cn(
            "font-semibold",
            strengthScore >= 4
              ? "text-emerald-500"
              : strengthScore >= 3
                ? "text-amber-500"
                : "text-muted-foreground"
          )}
        >
          {strengthLabel}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-200",
              strengthScore >= level
                ? strengthScore >= 4
                  ? "bg-emerald-500"
                  : strengthScore >= 3
                    ? "bg-amber-500"
                    : "bg-destructive"
                : "bg-border/60"
            )}
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-1.5 pt-0.5 text-[11px] sm:grid-cols-2">
        {rules.map((rule) => {
          const passed = criteria[rule.key]
          return (
            <li
              key={rule.key}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                passed ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {passed ? (
                <IconCheck className="size-3.5 shrink-0 text-emerald-500" />
              ) : (
                <IconCircle className="size-3 shrink-0 text-muted-foreground/50" />
              )}
              <span>{rule.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
