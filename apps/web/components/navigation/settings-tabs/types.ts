import React from "react";

export interface SettingsTabProps {
  onOpenChange?: (open: boolean) => void;
  setFooterContent?: (content: React.ReactNode | null) => void;
}
