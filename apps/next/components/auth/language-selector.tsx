"use client"

import React, { useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopover,
  SelectList,
  SelectItem,
} from "@workspace/ui/components/select"
import { locales, localeNames, type Locale } from "@/i18n/routing"
import { cn } from "@workspace/ui/lib/utils"

interface LanguageSelectorProps {
  variant?: "floating" | "inline"
  className?: string
}

export function LanguageSelector({
  variant = "floating",
  className,
}: LanguageSelectorProps) {
  const t = useTranslations("auth.languageSelector")
  const currentLocale = useLocale() as Locale
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSelectLocale = (nextLocale: Locale) => {
    if (!nextLocale || nextLocale === currentLocale) return

    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div
      className={cn(
        "z-50",
        variant === "floating" && "fixed top-5 right-5 md:top-8 md:right-8",
        className
      )}
    >
      <Select
        selectedKey={currentLocale}
        onSelectionChange={(key) => handleSelectLocale(key as Locale)}
        aria-label={t("selectLanguage")}
        isDisabled={isPending}
        className="w-auto"
      >
        <SelectTrigger
          size="sm"
          className="gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <SelectValue>
            {() => {
              const meta = localeNames[currentLocale] ?? localeNames.en
              return (
                <span className="flex items-center gap-1.5">
                  <span className="text-sm">{meta.flag}</span>
                  <span className="hidden font-mono text-[11px] text-muted-foreground uppercase sm:inline">
                    {currentLocale}
                  </span>
                  <span>{meta.nativeName}</span>
                </span>
              )
            }}
          </SelectValue>
        </SelectTrigger>

        <SelectPopover className="w-44 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          <SelectList className="flex flex-col gap-0.5 p-0">
            {locales.map((locale) => {
              const meta = localeNames[locale]
              return (
                <SelectItem
                  key={locale}
                  id={locale}
                  textValue={meta.nativeName}
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{meta.flag}</span>
                    <span>{meta.nativeName}</span>
                  </span>
                </SelectItem>
              )
            })}
          </SelectList>
        </SelectPopover>
      </Select>
    </div>
  )
}
