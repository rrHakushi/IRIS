"use client"

import React, { Suspense } from "react"
import Image from "next/image"
import { AkaromiVaultView } from "./components/akaromi-vault-view"

export default function PassPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Image
              src="/iris-pass512left-ring.png"
              alt="Akaromi"
              width={16}
              height={16}
              className="animate-pulse object-contain"
            />
            <span>Loading Akaromi...</span>
          </div>
        </div>
      }
    >
      <AkaromiVaultView filter="all" />
    </Suspense>
  )
}
