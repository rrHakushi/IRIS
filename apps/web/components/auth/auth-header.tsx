import React from "react";
import { cn } from "@workspace/ui/lib/utils";

interface AuthHeaderProps {
  title: string;
  description: string;
  className?: string;
}

/**
 * Server-rendered header for authentication pages.
 */
export function AuthHeader({ title, description, className }: AuthHeaderProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5 sm:gap-2 text-center pb-1", className)}>
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
        {title}
      </h1>
      <p className="text-balance text-muted-foreground text-xs sm:text-sm md:text-base">
        {description}
      </p>
    </div>
  );
}
