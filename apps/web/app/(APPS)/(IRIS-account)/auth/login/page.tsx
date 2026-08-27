import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthHeader } from "@/components/auth/auth-header";
import { AuthFooterLink } from "@/components/auth/auth-footer-link";
import { LoginForm } from "@/components/auth/login/login-form";
import { LanguageSelector } from "@/components/auth/language-selector";
import { AuthIllustrationProvider } from "@/components/auth/auth-illustration-context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return {
    title: `${t("welcomeBack")} | IRIS`,
    description: t("loginToIris"),
  };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <main className="flex min-h-svh w-full flex-col items-center justify-center p-4 sm:p-6 md:p-10 lg:p-12">
      <LanguageSelector variant="floating" />
      <div className="w-full max-w-md md:max-w-4xl lg:max-w-5xl">
        <AuthIllustrationProvider initialSrc="/images/auth/character/login-default.jpg">
          <AuthCard>
            <AuthHeader
              title={t("welcomeBack")}
              description={t("loginToIris")}
            />
            <LoginForm
              footer={
                <AuthFooterLink
                  promptText={t("dontHaveAccount")}
                  linkText={t("signUp")}
                  href="/auth/register"
                />
              }
            />
          </AuthCard>
        </AuthIllustrationProvider>
      </div>
    </main>
  );
}
