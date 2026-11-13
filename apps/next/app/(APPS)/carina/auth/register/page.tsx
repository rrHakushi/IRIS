import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AuthCard } from "@/components/auth/auth-card"
import { AuthHeader } from "@/components/auth/auth-header"
import { AuthFooterLink } from "@/components/auth/auth-footer-link"
import { RegisterForm } from "@/components/auth/register/register-form"
import { LanguageSelector } from "@/components/auth/language-selector"

export const metadata: Metadata = {
  title: "Carina | Auth > Register",
  description: "Carina Account Register",
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register")

  return (
    <main className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden bg-background p-4 sm:p-6 md:p-10 lg:p-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--muted-foreground)_12%,transparent),transparent_55%)]"
      />
      <LanguageSelector variant="floating" />
      <div className="relative w-full max-w-md md:max-w-4xl lg:max-w-5xl">
        <AuthCard>
          <AuthHeader
            title={t("createCredentials")}
            description={t("createIrisProfile")}
          />
          <RegisterForm
            footer={
              <AuthFooterLink
                promptText={t("registeredProfile")}
                linkText={t("signIn")}
                href="/carina/auth/login"
              />
            }
          />
        </AuthCard>
      </div>
    </main>
  )
}
