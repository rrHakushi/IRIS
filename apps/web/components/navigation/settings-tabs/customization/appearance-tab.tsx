"use client";

import React from "react";
import type { SettingsTabProps } from "../types";

export function AppearanceSettingsTab({}: SettingsTabProps): React.JSX.Element {
  return (
    <div className="flex-1 w-full space-y-6 pb-6 animate-in fade-in-50 duration-200">
      <div>
        <h3 className="text-base font-bold text-foreground">Appearance</h3>
      </div>
    </div>
  );
}
