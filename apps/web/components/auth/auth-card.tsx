import React from "react";
import { Card, CardContent } from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";
import { AuthHeroImage } from "./auth-hero-image";

interface AuthCardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode;
  heroImageSrc?: string;
  heroImageAlt?: string;
}

/**
 * Server-rendered card layout shell with reactive right-column hero banner.
 */
export function AuthCard({
  children,
  className,
  heroImageSrc = "/images/auth/character/login-default.jpg",
  heroImageAlt = "IRIS Companion",
  ...props
}: AuthCardProps) {
  return (
    <div className={cn("flex flex-col gap-6 w-full", className)} {...props}>
      <Card className="overflow-hidden p-0 shadow-lg md:min-h-[580px] flex flex-col justify-center">
        <CardContent className="grid p-0 md:grid-cols-2 md:min-h-[580px]">
          {/* Left Column: Form & Content */}
          <div className="p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center">
            {children}
          </div>

          {/* Right Column: Reactive Hero Banner Image */}
          <AuthHeroImage fallbackSrc={heroImageSrc} alt={heroImageAlt} />
        </CardContent>
      </Card>
    </div>
  );
}
