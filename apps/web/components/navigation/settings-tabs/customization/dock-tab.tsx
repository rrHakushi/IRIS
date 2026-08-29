"use client";

import React from "react";
import type { SettingsTabProps } from "../types";

export function DockSettingsTab({}: SettingsTabProps): React.JSX.Element {
  return (
    <div className="flex-1 w-full space-y-6 pb-6 animate-in fade-in-50 duration-200">
      <div>
        <h3 className="text-base font-bold text-foreground">Dock</h3>
      </div>
    </div>
  );
}
