import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AuthCard } from "@/components/auth/auth-card"
import { AuthHeader } from "@/components/auth/auth-header"
import { AuthFooterLink } from "@/components/auth/auth-footer-link"
import { RegisterForm } from "@/components/auth/register/register-form"
import { LanguageSelector } from "@/components/auth/language-selector"
import { AuthIllustrationProvider } from "@/components/auth/auth-illustration-context"

export const metadata: Metadata = {
  title: "IRIS Account | Register",
  description: "IRIS Account Register",
}

export default async function RegisterPage() {
  const t = await getTranslations("auth.register")

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center p-4 sm:p-6 md:p-10 lg:p-12">
      <LanguageSelector variant="floating" />
      <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl">
        <AuthIllustrationProvider initialSrc="/images/auth/character/register-default.jpg">
          <AuthCard heroImageSrc="/images/auth/character/register-default.jpg">
            <AuthHeader
              title={t("createCredentials")}
              description={t("createIrisProfile")}
            />
            <RegisterForm
              footer={
                <AuthFooterLink
                  promptText={t("registeredProfile")}
                  linkText={t("signIn")}
                  href="/IRIS-account/auth/login"
                />
              }
            />
          </AuthCard>
        </AuthIllustrationProvider>
      </div>
    </main>
  )
}
