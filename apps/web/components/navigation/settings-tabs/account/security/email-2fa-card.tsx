"use client";

import React from "react";
import { Switch } from "@workspace/ui/components/switch";
import { Badge } from "@workspace/ui/components/badge";
import { IconMail, IconMailCheck } from "@tabler/icons-react";

export interface Email2faCardProps {
  enabled: boolean;
  originalEnabled: boolean;
  email: string;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function Email2faCard({
  enabled,
  originalEnabled,
  email,
  onChange,
  disabled = false,
}: Email2faCardProps): React.JSX.Element {
  const isDirty = enabled !== originalEnabled;

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5 space-y-3.5 sm:space-y-4 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <IconMail className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm text-foreground">
                Email Two-Factor Authentication
              </h4>
              {enabled ? (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4.5 px-2 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-semibold"
                >
                  Enabled
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4.5 px-2 text-muted-foreground border-border font-medium"
                >
                  Disabled
                </Badge>
              )}
              {isDirty && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium animate-pulse">
                  Pending Save
                </span>
              )}
            </div>
          </div>
        </div>

        <Switch
          isSelected={enabled}
          onChange={onChange}
          isDisabled={disabled}
          aria-label="Toggle Email Two-Factor Authentication"
        />
      </div>

      <div className="rounded-xl border border-border/50 bg-background/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <IconMailCheck className="size-4 text-primary shrink-0" />
          <span>Codes will be delivered to:</span>
        </div>
        <span className="text-xs font-mono font-medium text-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border/60 truncate">
          {email || "No email linked"}
        </span>
      </div>
    </div>
  );
}
