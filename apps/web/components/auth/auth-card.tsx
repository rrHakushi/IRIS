import React from "react"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { AuthHeroImage } from "./auth-hero-image"

interface AuthCardProps extends React.ComponentProps<"div"> {
  children: React.ReactNode
  heroImageSrc?: string
  heroImageAlt?: string
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
    <div className={cn("flex w-full flex-col gap-6", className)} {...props}>
      <Card className="flex flex-col justify-center overflow-hidden p-0 shadow-lg md:min-h-[580px]">
        <CardContent className="grid p-0 md:min-h-[580px] md:grid-cols-2">
          {/* Left Column: Form & Content */}
          <div className="flex flex-col justify-center p-6 sm:p-8 md:p-10 lg:p-12">
            {children}
          </div>

          {/* Right Column: Reactive Hero Banner Image */}
          <AuthHeroImage fallbackSrc={heroImageSrc} alt={heroImageAlt} />
        </CardContent>
      </Card>
    </div>
  )
}
