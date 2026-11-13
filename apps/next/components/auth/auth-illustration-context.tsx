"use client"

import React, { createContext, useContext, useState } from "react"

interface AuthIllustrationContextValue {
  illustration: string
  setIllustration: (src: string) => void
}

const AuthIllustrationContext = createContext<AuthIllustrationContextValue>({
  illustration: "/images/auth/character/login-default.jpg",
  setIllustration: () => {},
})

export function AuthIllustrationProvider({
  initialSrc = "/images/auth/character/login-default.jpg",
  children,
}: {
  initialSrc?: string
  children: React.ReactNode
}) {
  const [illustration, setIllustration] = useState(initialSrc)
  return (
    <AuthIllustrationContext.Provider value={{ illustration, setIllustration }}>
      {children}
    </AuthIllustrationContext.Provider>
  )
}

export function useAuthIllustration() {
  return useContext(AuthIllustrationContext)
}
