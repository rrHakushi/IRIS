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
            className="bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-6xl"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #10b981 0%, #06b6d4 25%, #2563eb 50%, #7c3aed 75%, #1e1b4b 100%)",
            }}
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

