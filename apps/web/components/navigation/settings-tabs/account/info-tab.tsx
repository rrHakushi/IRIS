"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { SettingsTabProps } from "../types";

export function InfoSettingsTab({}: SettingsTabProps): React.JSX.Element {
  const t = useTranslations("navigation.settings.account.info");

  return (
    <div className="flex-1 w-full space-y-6 pb-6 animate-in fade-in-50 duration-200">
      <div>
        <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
      </div>
    </div>
  );
}
