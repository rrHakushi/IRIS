"use client"

import React from "react"
import { useTranslations } from "next-intl"
import type { SettingsTabProps } from "../types"

export function InfoSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.info")

  return (
    <div className="w-full flex-1 animate-in space-y-6 pb-6 duration-200 fade-in-50">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
      </div>
    </div>
  )
}
