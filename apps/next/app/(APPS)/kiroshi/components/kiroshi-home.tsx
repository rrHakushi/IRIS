"use client"

import React, { memo } from "react"
import { KiroshiSearchInput } from "./kiroshi-search-input"

export interface KiroshiHomeProps {
  onSearch: (query: string) => void
}

export const KiroshiHome = memo(function KiroshiHome({
  onSearch,
}: KiroshiHomeProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-24">
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center space-y-6 sm:space-y-8 text-center">
        {/* Brand Hero */}
        <div className="flex flex-col items-center space-y-2">
          <h1
            className="bg-gradient-to-br from-emerald-500 via-cyan-500 to-violet-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl"
          >
            Kiroshi
          </h1>
        </div>

        {/* Hero Search Box */}
        <div className="w-full">
          <KiroshiSearchInput
            variant="hero"
            placeholder="Search the web, images, code, news..."
            autoFocus
            onSubmit={onSearch}
          />
        </div>
      </div>
    </div>
  )
})

