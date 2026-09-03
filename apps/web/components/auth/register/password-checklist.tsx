"use client"

import React from "react"
import { useTranslations } from "next-intl"
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

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              "h-1.5 flex-1 rounded-full",
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

      <ul className="grid grid-cols-1 gap-1 pt-1 text-[11px]">
        {rules.map((rule) => {
          const passed = criteria[rule.key]
          return (
            <li
              key={rule.key}
              className={cn(
                "flex items-center gap-2",
                passed ? "font-medium text-primary" : "text-muted-foreground"
              )}
            >
              <span className="font-mono text-xs">{passed ? "✓" : "•"}</span>
              <span>{rule.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
