import React from "react"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { AuthHeroImage } from "./auth-hero-image"

interface AuthCardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode
}

/**
 * Server-rendered split card layout shell with desktop-only lazy-loaded reactive hero stage.
 */
export function AuthCard({ children, className, ...props }: AuthCardProps) {
  return (
    <div className={cn("flex w-full flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-3xl border-border/70 bg-card/95 p-0 shadow-2xl backdrop-blur-xl md:min-h-[640px]">
        <CardContent className="grid p-0 md:min-h-[640px] md:grid-cols-[1.05fr_0.95fr]">
          {/* Start Column: Form & Flow */}
          <div className="flex flex-col justify-center gap-6 p-6 sm:p-8 md:p-10 lg:p-12">
            {children}
          </div>

          {/* End Column: Lazy-loaded Reactive Hero Stage (desktop only) */}
          <AuthHeroImage />
        </CardContent>
      </Card>
    </div>
  )
}
