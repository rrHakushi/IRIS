"use client"

import React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

export function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:border group-[.toaster]:backdrop-blur-xl",
          description: "group-[.toast]:text-muted-foreground text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:px-3 group-[.toast]:py-1.5 cursor-pointer",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl cursor-pointer",
          closeButton:
            "group-[.toast]:bg-card group-[.toast]:text-muted-foreground group-[.toast]:border-border group-[.toast]:hover:text-foreground cursor-pointer",
        },
      }}
      {...props}
    />
  )
}
